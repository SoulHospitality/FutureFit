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

const types = new Map();
const cats = new Map();
const genders = new Map();
let active = 0;
for (const r of rows.slice(1)) {
  if (!get(r, 'Title')) continue;
  if ((get(r, 'Status') || '').toLowerCase() !== 'active') continue;
  active++;
  const t = get(r, 'Type') || '(empty)';
  const c = get(r, 'Product Category') || '(empty)';
  const g = get(r, 'Target gender (product.metafields.shopify.target-gender)') || '(empty)';
  types.set(t, (types.get(t) || 0) + 1);
  cats.set(c, (cats.get(c) || 0) + 1);
  genders.set(g, (genders.get(g) || 0) + 1);
}

console.log('Active titled rows', active);
console.log('\nTypes:');
[...types.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(v, k));
console.log('\nProduct Category (top 20):');
[...cats.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .forEach(([k, v]) => console.log(v, k));
console.log('\nTarget gender:');
[...genders.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(v, k));
