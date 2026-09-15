/**
 * Remap existing products' audience + category from Shopify CSV (no wipe).
 * Matches by exact title, then falls back to case-insensitive trim.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { ensureDefaultCategories } = require('../utils/catalog');
const { mapAudience, mapCategorySlug } = require('../utils/shopifyMap');
const cache = require('../lib/cache');

const prisma = new PrismaClient();
const csvPath =
  process.argv[2] || path.join(__dirname, '../data/products_export_1.csv');

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

function buildCsvMap(filePath) {
  const rows = parseCSV(fs.readFileSync(filePath, 'utf8'));
  const header = rows[0];
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const get = (r, key) => (r[idx[key]] != null ? String(r[idx[key]]) : '');
  const byHandle = new Map();
  for (const r of rows.slice(1)) {
    const h = get(r, 'Handle');
    if (!h) continue;
    if (!byHandle.has(h)) byHandle.set(h, []);
    byHandle.get(h).push(r);
  }
  const byTitle = new Map();
  for (const [, list] of byHandle) {
    const tr = list.find((r) => get(r, 'Title')) || list[0];
    if ((get(tr, 'Status') || '').toLowerCase() !== 'active') continue;
    const title = get(tr, 'Title').trim();
    if (!title) continue;
    const tags = get(tr, 'Tags');
    const shopifyType = get(tr, 'Type');
    const productCategory = get(tr, 'Product Category');
    const audience = mapAudience(tags, title, shopifyType, productCategory);
    const slug = mapCategorySlug(productCategory, shopifyType, title, tags, audience);
    byTitle.set(title.toLowerCase(), { audience, slug, title });
  }
  return byTitle;
}

async function main() {
  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }
  await ensureDefaultCategories(prisma);
  const categories = await prisma.category.findMany();
  const byKey = Object.fromEntries(categories.map((c) => [`${c.audience}:${c.slug}`, c]));
  const csvMap = buildCsvMap(csvPath);
  const products = await prisma.product.findMany({
    select: { id: true, name: true, audience: true, categoryId: true, type: true },
  });

  let updated = 0;
  let unmatched = 0;
  for (const p of products) {
    const hit = csvMap.get(String(p.name || '').trim().toLowerCase());
    if (!hit) {
      // Title-only remap for obvious keywords on unmatched/merged names
      const titleL = String(p.name || '').toLowerCase();
      let audience = p.audience || 'men';
      let slug = null;
      if (/hoodie/.test(titleL)) slug = 'hoodies';
      else if (/\bboxers?\b/.test(titleL)) slug = 'boxers';
      else if (/sock/.test(titleL)) slug = 'socks';
      else if (/undershirt|t-?shirt/.test(titleL)) {
        slug = audience === 'women' ? 'womens-undershirts' : 't-shirts';
      }
      if (!slug) {
        unmatched += 1;
        continue;
      }
      const cat = byKey[`${audience}:${slug}`];
      if (!cat) continue;
      if (p.categoryId === cat.id && p.audience === audience) continue;
      await prisma.product.update({
        where: { id: p.id },
        data: { audience, categoryId: cat.id },
      });
      updated += 1;
      continue;
    }
    const cat = byKey[`${hit.audience}:${hit.slug}`];
    if (!cat) continue;
    if (p.categoryId === cat.id && p.audience === hit.audience) continue;
    await prisma.product.update({
      where: { id: p.id },
      data: { audience: hit.audience, categoryId: cat.id },
    });
    updated += 1;
  }

  try {
    cache.flush();
  } catch (_) {
    /* optional */
  }

  const byCat = await prisma.category.findMany({
    where: { parentId: { not: null } },
    include: { _count: { select: { products: true } } },
    orderBy: [{ audience: 'asc' }, { sortOrder: 'asc' }],
  });
  console.log(`Updated ${updated} products. Unmatched: ${unmatched}`);
  console.log('\nProducts per subcategory:');
  for (const c of byCat) {
    if (c._count.products > 0) console.log(`  ${c.audience}/${c.slug}: ${c._count.products}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
