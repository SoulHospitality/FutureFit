/**
 * Import Future Fit - CLR.xlsx (men). Skips the two EXAMPLE rows.
 * Size variants that share a base Item ID (e.g. BX-BLK-M/L/XL) become one product.
 *
 * Usage: node scripts/import-men-clr.js "C:/Users/hazem/Downloads/Future Fit - CLR.xlsx"
 */
require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');
const prisma = require('../lib/prisma');
const cache = require('../lib/cache');
const { resolvePhotoLinks } = require('../utils/drivePhotos');
const { ensureDefaultCategories, typeFromCategory } = require('../utils/catalog');
const { cleanItemCode } = require('../utils/itemCode');
const { sizeStockWrites } = require('../utils/sizeStock');

const FILE =
  process.argv[2] ||
  path.join(process.env.USERPROFILE || '', 'Downloads', 'Future Fit - CLR.xlsx');

const SIZE_SUF = /-(XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL)$/i;
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL'];

const stripSizeFromText = (text) =>
  String(text || '')
    .replace(/\s*[–—|-]\s*(X{0,3}-?Large|XX-Large|XXX-Large|X-Large|Medium|Small|Large)\b.*$/i, '')
    .replace(/\s*\|\s*(X{0,3}-?Large|XX-Large|XXX-Large|X-Large|Medium|Small|Large)\b.*$/i, '')
    .replace(/\s*Size:\s*[^.]*\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const splitList = (value) =>
  String(value || '')
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean);

const parseBool = (value) => {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'y';
};

const parseMoney = (value) => {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

const sizeRank = (size) => {
  const i = SIZE_ORDER.indexOf(String(size || '').toUpperCase());
  return i === -1 ? 100 : i;
};

const photoCache = new Map();
const resolveFolder = async (folder) => {
  const key = String(folder || '').trim();
  if (!key) return [];
  if (photoCache.has(key)) return photoCache.get(key);
  try {
    const photos = await resolvePhotoLinks([key]);
    photoCache.set(key, photos);
    return photos;
  } catch (err) {
    console.warn('Photos skipped for folder:', key.slice(0, 80), '→', err.message);
    photoCache.set(key, []);
    return [];
  }
};

const loadRows = (filePath) => {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rows.filter((r) => {
    const id = String(r['Item ID'] || r.item_id || r.itemid || '').trim();
    if (!id || id.toUpperCase() === 'EXAMPLES') return false;
    return Boolean(String(r.name || '').trim());
  });
};

const groupRows = (rows) => {
  const groups = new Map();
  for (const row of rows) {
    const rawId = String(row['Item ID'] || '').trim().toUpperCase();
    const baseId = rawId.replace(SIZE_SUF, '') || rawId;
    if (!groups.has(baseId)) groups.set(baseId, []);
    groups.get(baseId).push(row);
  }
  return groups;
};

const buildSizeStocks = (rows) => {
  const bySize = new Map();
  for (const row of rows) {
    const sizes = splitList(row.sizes);
    const stocks = String(row.stocks ?? '')
      .split(/[,|]/)
      .map((s) => s.trim());
    if (!sizes.length) {
      bySize.set('One size', Math.max(0, Number(row.stocks) || 0));
      continue;
    }
    sizes.forEach((size, i) => {
      const stock =
        stocks.length === sizes.length
          ? Math.max(0, Number(stocks[i]) || 0)
          : Math.max(0, Number(row.stocks) || 0);
      bySize.set(size, (bySize.get(size) || 0) + stock);
    });
  }
  return [...bySize.entries()]
    .map(([size, stock]) => ({ size, stock }))
    .sort((a, b) => sizeRank(a.size) - sizeRank(b.size) || a.size.localeCompare(b.size));
};

async function main() {
  console.log('Reading', FILE);
  const rows = loadRows(FILE);
  console.log('Data rows (after skipping examples):', rows.length);
  if (!rows.length) throw new Error('No product rows found');

  await ensureDefaultCategories(prisma);
  const categories = await prisma.category.findMany({ where: { audience: 'men' } });
  const bySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

  const groups = groupRows(rows);
  console.log('Products after merging sizes:', groups.size);

  let created = 0;
  const errors = [];

  for (const [itemCodeRaw, group] of groups) {
    const first = group[0];
    try {
      const itemCode = cleanItemCode(itemCodeRaw);
      const categorySlug = String(first.category || '').trim().toLowerCase();
      const category = bySlug[categorySlug];
      if (!category || !category.parentId) {
        throw new Error(`Unknown men category "${categorySlug}"`);
      }

      const sizeStocks = buildSizeStocks(group);
      if (!sizeStocks.length) throw new Error('No sizes/stock');

      const photos = await resolveFolder(first.drive_folder || first.driveFolder);
      const colors = splitList(first.colors);
      const price = parseMoney(first.price);
      if (price == null || price <= 0) {
        throw new Error('Price is missing — fill the price column and re-import this style');
      }
      const cost = parseMoney(first.Cost ?? first.cost);
      const isSale = parseBool(first.is_sale || first.is_sale_active);
      const salePrice = parseMoney(first.sale_price ?? first.salePrice);

      const name = stripSizeFromText(first.name) || String(first.name).trim();
      const description =
        stripSizeFromText(first.description) || String(first.description || name).trim();

      const [maxAll, maxMen] = await Promise.all([
        prisma.product.aggregate({ _max: { shopSortAll: true } }),
        prisma.product.aggregate({ where: { audience: 'men' }, _max: { shopSortMen: true } }),
      ]);

      await prisma.product.create({
        data: {
          itemCode,
          name,
          description,
          price,
          cost,
          type: typeFromCategory(category),
          audience: 'men',
          status: 'active',
          categoryId: category.id,
          photos,
          colors,
          sizes: sizeStocks.map((r) => r.size),
          stock: sizeStocks.reduce((n, r) => n + r.stock, 0),
          isSaleActive: isSale && salePrice != null,
          salePrice: isSale ? salePrice : null,
          shopSortAll: (maxAll._max.shopSortAll ?? -1) + 1,
          shopSortMen: (maxMen._max.shopSortMen ?? -1) + 1,
          shopSortWomen: 0,
          shopSortKids: 0,
          sizeStocks: { create: sizeStockWrites(sizeStocks) },
        },
      });
      created += 1;
      if (created % 10 === 0) console.log(`… ${created}/${groups.size}`);
    } catch (err) {
      errors.push({ itemCode: itemCodeRaw, name: first.name, message: err.message });
      console.error('FAIL', itemCodeRaw, err.message);
    }
  }

  cache.invalidate('products');
  cache.invalidate('product');
  console.log(JSON.stringify({ created, failed: errors.length, errors: errors.slice(0, 20) }, null, 2));
  process.exit(errors.length && !created ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
