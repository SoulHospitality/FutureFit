const fs = require('fs');
const path = require('path');

const csvPath = path.join(process.env.USERPROFILE || '', 'Downloads', 'products_export_1.csv');
const text = fs.readFileSync(csvPath, 'utf8');

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

const rows = parseCSV(text);
const header = rows[0];
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const get = (r, key) => r[idx[key]] || '';

console.log('data rows', rows.length - 1);
const handles = new Set();
const types = new Map();
const genders = new Map();
const statuses = new Map();
const opt1 = new Map();
const opt2 = new Map();
let imgRows = 0;
let activeTitles = 0;

for (const r of rows.slice(1)) {
  const h = get(r, 'Handle');
  if (!h) continue;
  handles.add(h);
  if (get(r, 'Image Src')) imgRows++;
  if (!get(r, 'Title')) continue;
  activeTitles++;
  const t = get(r, 'Type') || '(blank)';
  types.set(t, (types.get(t) || 0) + 1);
  const g =
    get(r, 'Target gender (product.metafields.shopify.target-gender)') || '(blank)';
  genders.set(g, (genders.get(g) || 0) + 1);
  const st = get(r, 'Status') || '(blank)';
  statuses.set(st, (statuses.get(st) || 0) + 1);
  opt1.set(get(r, 'Option1 Name') || '(blank)', (opt1.get(get(r, 'Option1 Name') || '(blank)') || 0) + 1);
  opt2.set(get(r, 'Option2 Name') || '(blank)', (opt2.get(get(r, 'Option2 Name') || '(blank)') || 0) + 1);
}

console.log('unique handles', handles.size);
console.log('title rows', activeTitles);
console.log(
  'types',
  [...types.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
);
console.log('genders', [...genders.entries()]);
console.log('statuses', [...statuses.entries()]);
console.log('opt1', [...opt1.entries()]);
console.log('opt2', [...opt2.entries()]);
console.log('image rows', imgRows);

const first = rows.slice(1).find((r) => get(r, 'Title'));
console.log('\nSAMPLE');
console.log('Title', get(first, 'Title'));
console.log('Type', get(first, 'Type'));
console.log('Tags', get(first, 'Tags'));
console.log('Price', get(first, 'Variant Price'), 'Compare', get(first, 'Variant Compare At Price'));
console.log('Opt1', get(first, 'Option1 Name'), get(first, 'Option1 Value'));
console.log('Opt2', get(first, 'Option2 Name'), get(first, 'Option2 Value'));
console.log('Qty', get(first, 'Variant Inventory Qty'));
console.log('Status', get(first, 'Status'), 'Published', get(first, 'Published'));
console.log('Img', get(first, 'Image Src').slice(0, 100));
console.log('Body len', get(first, 'Body (HTML)').length);
