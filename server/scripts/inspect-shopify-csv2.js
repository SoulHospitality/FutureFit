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

const byHandle = new Map();
for (const r of rows.slice(1)) {
  const h = get(r, 'Handle');
  if (!h) continue;
  if (!byHandle.has(h)) byHandle.set(h, []);
  byHandle.get(h).push(r);
}

let sizeProducts = 0;
let titleProducts = 0;
let multiSize = 0;
const sizeExamples = [];
for (const [h, list] of byHandle) {
  const titleRow = list.find((r) => get(r, 'Title')) || list[0];
  if (get(titleRow, 'Status') !== 'active') continue;
  const opt = get(titleRow, 'Option1 Name');
  if (opt === 'Size') {
    sizeProducts++;
    const sizes = [...new Set(list.map((r) => get(r, 'Option1 Value')).filter(Boolean))];
    if (sizes.length > 1) {
      multiSize++;
      if (sizeExamples.length < 3) {
        sizeExamples.push({
          h,
          title: get(titleRow, 'Title'),
          sizes,
          qtys: list.map((r) => [get(r, 'Option1 Value'), get(r, 'Variant Inventory Qty')]),
          colorMeta: get(titleRow, 'Color (product.metafields.shopify.color-pattern)'),
          tags: get(titleRow, 'Tags'),
        });
      }
    }
  } else titleProducts++;
}
console.log({ sizeProducts, titleProducts, multiSize, sizeExamples });

// tag audience samples
const tagSamples = [];
for (const [h, list] of byHandle) {
  const t = list.find((r) => get(r, 'Title'));
  if (!t || get(t, 'Status') !== 'active') continue;
  if (tagSamples.length < 15) {
    tagSamples.push({
      title: get(t, 'Title'),
      type: get(t, 'Type'),
      tags: get(t, 'Tags'),
      color: get(t, 'Color (product.metafields.shopify.color-pattern)'),
    });
  }
}
console.log(JSON.stringify(tagSamples, null, 2));
