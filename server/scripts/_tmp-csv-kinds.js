const fs = require('fs');
const path = require('path');

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

const file = path.join(__dirname, '../data/products_export_1.csv');
const rows = parseCSV(fs.readFileSync(file, 'utf8'));
const header = rows[0];
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const get = (r, k) => (r[idx[k]] != null ? String(r[idx[k]]) : '');

const needles = ['boxer', 'undershirt', 'hoodie', 'pant', 'pajama', 'sleep', 'legging', 'dress', 'denim', 'panty'];
for (const needle of needles) {
  console.log('\n====', needle, '====');
  let n = 0;
  const byHandle = new Map();
  for (const r of rows.slice(1)) {
    const h = get(r, 'Handle');
    if (!h) continue;
    if (!byHandle.has(h)) byHandle.set(h, r);
  }
  for (const r of byHandle.values()) {
    if ((get(r, 'Status') || '').toLowerCase() !== 'active') continue;
    const title = get(r, 'Title');
    if (!title) continue;
    const blob = `${title} ${get(r, 'Type')} ${get(r, 'Product Category')}`.toLowerCase();
    if (!blob.includes(needle)) continue;
    console.log(title.slice(0, 75));
    console.log('  Type:', get(r, 'Type'), '| Cat leaf:', get(r, 'Product Category').split('>').pop()?.trim());
    if (++n >= 6) break;
  }
}
