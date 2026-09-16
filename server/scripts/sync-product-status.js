/**
 * Sync product status (active/draft) from a Shopify CSV/XLSX by matching titles.
 * Usage: node scripts/sync-product-status.js [path-to-xlsx-or-csv]
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const cache = require('../lib/cache');

const prisma = new PrismaClient();
const filePath =
  process.argv[2] ||
  path.join(process.env.USERPROFILE || '', 'Downloads', 'products_export_1 (2).xlsx');

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (q) {
      if (c === '"' && n === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && n === '\n') i++;
      row.push(cur);
      cur = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur.length || row.length) {
    row.push(cur);
    if (row.some((x) => x !== '')) rows.push(row);
  }
  return rows;
}

function loadRows(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.xlsx' || ext === '.xls') {
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(file);
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  }
  const rows = parseCSV(fs.readFileSync(file, 'utf8'));
  const header = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function normalizeTitle(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function baseTitle(t) {
  return normalizeTitle(t)
    .replace(
      /,?\s*(off white|dark green|dark red|sky blue|light blue|dark blue|light grey|dark grey|light gray|dark gray|multicolor|multi.?color|charcoal|burgundy|lavender|mustard|natural|indigo|ivory|olive|purple|yellow|orange|maroon|khaki|coral|teal|camel|silver|cream|beige|biege|rose|pink|navy|white|black|grey|gray|green|brown|nude|skin|mint|wine|tan|gold|sand|rust|red|blue)\s*$/i,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }
  const objects = loadRows(filePath);
  const byHandle = new Map();
  for (const r of objects) {
    const h = String(r.Handle || '').trim();
    if (!h) continue;
    const title = String(r.Title || '').trim();
    if (!byHandle.has(h) || title) byHandle.set(h, r);
  }

  const exactStatus = new Map();
  const baseStatus = new Map();
  for (const r of byHandle.values()) {
    const title = String(r.Title || '').trim();
    if (!title) continue;
    const raw = String(r.Status || '').toLowerCase().trim();
    if (raw === 'archived') continue;
    const status = raw === 'active' ? 'active' : 'draft';
    const exact = normalizeTitle(title);
    const base = baseTitle(title);
    if (exactStatus.get(exact) !== 'active') exactStatus.set(exact, status);
    if (status === 'active' || !baseStatus.has(base)) baseStatus.set(base, status);
    if (status === 'active') baseStatus.set(base, 'active');
  }

  const products = await prisma.product.findMany({
    select: { id: true, name: true, status: true },
  });
  let updated = 0;
  let active = 0;
  let draft = 0;
  for (const p of products) {
    const exact = normalizeTitle(p.name);
    const base = baseTitle(p.name);
    const next = exactStatus.get(exact) || baseStatus.get(base) || 'active';
    if (next === 'active') active += 1;
    else draft += 1;
    if (p.status !== next) {
      await prisma.product.update({ where: { id: p.id }, data: { status: next } });
      updated += 1;
    }
  }

  try {
    cache.flush();
  } catch (_) {
    /* optional */
  }

  console.log({
    sheetTitles: exactStatus.size,
    products: products.length,
    updated,
    active,
    draft,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
