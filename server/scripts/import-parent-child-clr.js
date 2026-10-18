/**
 * Import Future Fit - CLR (1).xlsx with Parent SKU / child color×size rows.
 * Parent rows have colors=Parent, sizes=Parent. Children point at Parent SKU.
 *
 * Usage:
 *   node scripts/import-parent-child-clr.js "C:/Users/hazem/Downloads/Future Fit - CLR (1).xlsx"
 *   node scripts/import-parent-child-clr.js --wipe "path.xlsx"
 */
require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');
const prisma = require('../lib/prisma');
const cache = require('../lib/cache');
const { resolvePhotoLinks } = require('../utils/drivePhotos');
const { ensureDefaultCategories, typeFromCategory } = require('../utils/catalog');
const { cleanItemCode } = require('../utils/itemCode');
const {
  variantWrites,
  colorsFromVariants,
  sizesFromVariants,
  photoByColorFromVariants,
} = require('../utils/variants');

const args = process.argv.slice(2).filter((a) => a !== '--wipe');
const WIPE = process.argv.includes('--wipe');
const FILE =
  args[0] ||
  path.join(process.env.USERPROFILE || '', 'Downloads', 'Future Fit - CLR (1).xlsx');

const stripSizeFromText = (text) =>
  String(text || '')
    .replace(/\s*[–—|-]\s*(X{0,3}-?Large|XX-Large|XXX-Large|X-Large|Medium|Small|Large)\b.*$/i, '')
    .replace(/\s*\|\s*(X{0,3}-?Large|XX-Large|XXX-Large|X-Large|Medium|Small|Large)\b.*$/i, '')
    .replace(/\s*Size:\s*[^.]*\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const parseBool = (value) => {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'y';
};

const parseMoney = (value) => {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

const isParentMarker = (value) => String(value || '').trim().toLowerCase() === 'parent';

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
    console.warn('Photos skipped:', key.slice(0, 80), '→', err.message);
    photoCache.set(key, []);
    return [];
  }
};

const loadRows = (filePath) => {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rows.filter((r) => {
    const id = String(r['Item ID'] || r.item_id || '').trim();
    if (!id || id.toUpperCase() === 'EXAMPLES') return false;
    return Boolean(String(r.name || '').trim());
  });
};

async function wipeCatalog() {
  const deletedVariants = await prisma.productVariant.deleteMany({});
  const deletedSizes = await prisma.productSize.deleteMany({});
  const deletedHome = await prisma.homepageProduct.deleteMany({});
  const deletedProducts = await prisma.product.deleteMany({});
  console.log('Wiped catalog:', {
    products: deletedProducts.count,
    variants: deletedVariants.count,
    sizeRows: deletedSizes.count,
    homepage: deletedHome.count,
  });
}

async function main() {
  console.log('Reading', FILE);
  const rows = loadRows(FILE);
  console.log('Data rows:', rows.length);
  if (!rows.length) throw new Error('No product rows found');

  if (WIPE) await wipeCatalog();

  await ensureDefaultCategories(prisma);
  const categories = await prisma.category.findMany();
  const bySlugAudience = Object.fromEntries(
    categories.map((c) => [`${c.audience}:${c.slug}`, c])
  );

  // Any row without Parent SKU is a parent. Rows with Parent SKU are children.
  const parents = new Map();

  for (const row of rows) {
    const itemId = cleanItemCode(row['Item ID']);
    const parentSku = cleanItemCode(row['Parent SKU'] || row.parent_sku || '');

    if (!parentSku) {
      if (!parents.has(itemId)) parents.set(itemId, { parent: row, children: [] });
      else parents.get(itemId).parent = row;
      continue;
    }
    if (!parents.has(parentSku)) {
      parents.set(parentSku, { parent: null, children: [] });
    }
    parents.get(parentSku).children.push(row);
  }

  console.log('Parent groups:', parents.size);

  let created = 0;
  const errors = [];

  for (const [parentCode, group] of parents) {
    const parentRow = group.parent;
    let children = group.children;
    try {
      if (!parentRow) throw new Error('Missing parent row');

      // Standalone parent: no child rows → the parent row is also its only sellable variant
      if (!children.length) {
        const color = String(parentRow.colors || '').trim();
        const size = String(parentRow.sizes || '').trim();
        if (!color || !size || isParentMarker(color) || isParentMarker(size)) {
          throw new Error('Parent has no children and no sellable color/size of its own');
        }
        children = [parentRow];
      }

      const firstChild = children[0];
      const audience = String(
        parentRow.audience || firstChild.audience || 'men'
      )
        .trim()
        .toLowerCase();
      const categorySlug = String(
        parentRow.category || firstChild.category || ''
      )
        .trim()
        .toLowerCase();
      const category = bySlugAudience[`${audience}:${categorySlug}`];
      if (!category || !category.parentId) {
        throw new Error(`Unknown category "${categorySlug}" for ${audience}`);
      }

      const variants = [];
      const folderPhotos = new Map();
      const usedChildCodes = new Set([parentCode]);

      for (const child of children) {
        const color = String(child.colors || '').trim();
        const size = String(child.sizes || '').trim();
        if (!color || !size || isParentMarker(color) || isParentMarker(size)) {
          throw new Error(`Bad child color/size on ${child['Item ID']}`);
        }
        const folder = String(child.drive_folder || child.driveFolder || '').trim();
        let photos = [];
        if (folder) {
          if (!folderPhotos.has(folder)) {
            folderPhotos.set(folder, await resolveFolder(folder));
          }
          photos = folderPhotos.get(folder);
        }
        const price = parseMoney(child.price);
        const cost = parseMoney(child.Cost ?? child.cost);
        let childCode = cleanItemCode(child['Item ID']);
        // Parent + self-child share the same sheet Item ID — suffix the child code
        if (usedChildCodes.has(childCode)) {
          childCode = cleanItemCode(`${childCode}-${size}`) || `${childCode}-V`;
          let n = 2;
          while (usedChildCodes.has(childCode)) {
            childCode = `${parentCode}-V${n}`;
            n += 1;
          }
        }
        usedChildCodes.add(childCode);
        variants.push({
          itemCode: childCode,
          color,
          size,
          stock: Math.max(0, Math.floor(Number(child.stocks) || 0)),
          price,
          cost,
          photos,
        });
      }

      const prices = variants.map((v) => v.price).filter((p) => p != null && p > 0);
      const parentPrice = parseMoney(parentRow.price) ?? (prices.length ? Math.min(...prices) : null);
      if (parentPrice == null || parentPrice <= 0) {
        throw new Error('No price on parent or children');
      }

      const costs = variants.map((v) => v.cost).filter((c) => c != null);
      const parentCost = parseMoney(parentRow.Cost ?? parentRow.cost) ?? (costs.length ? costs[0] : null);

      const isSale = parseBool(parentRow.is_sale || firstChild.is_sale);
      const salePrice = parseMoney(parentRow.sale_price ?? firstChild.sale_price);

      const name =
        stripSizeFromText(parentRow.name) || String(parentRow.name).trim();
      const description =
        stripSizeFromText(parentRow.description) ||
        String(parentRow.description || name).trim();

      const allPhotos = [];
      const seenPhoto = new Set();
      for (const v of variants) {
        for (const url of v.photos || []) {
          if (seenPhoto.has(url)) continue;
          seenPhoto.add(url);
          allPhotos.push(url);
        }
      }

      const colors = colorsFromVariants(variants);
      const sizes = sizesFromVariants(variants);
      const photoByColor = photoByColorFromVariants(variants);
      const stock = variants.reduce((n, v) => n + v.stock, 0);

      const [maxAll, maxAud] = await Promise.all([
        prisma.product.aggregate({ _max: { shopSortAll: true } }),
        prisma.product.aggregate({
          where: { audience },
          _max: {
            shopSortMen: true,
            shopSortWomen: true,
            shopSortKids: true,
          },
        }),
      ]);
      const audField =
        audience === 'women'
          ? 'shopSortWomen'
          : audience === 'kids'
            ? 'shopSortKids'
            : 'shopSortMen';

      await prisma.product.create({
        data: {
          itemCode: parentCode,
          name,
          description,
          price: parentPrice,
          cost: parentCost,
          type: typeFromCategory(category),
          audience,
          status: 'active',
          categoryId: category.id,
          photos: allPhotos.slice(0, 24),
          colors,
          photoByColor,
          sizes,
          stock,
          isSaleActive: isSale && salePrice != null,
          salePrice: isSale ? salePrice : null,
          shopSortAll: (maxAll._max.shopSortAll ?? -1) + 1,
          shopSortMen: audience === 'men' ? (maxAud._max.shopSortMen ?? -1) + 1 : 0,
          shopSortWomen:
            audience === 'women' ? (maxAud._max.shopSortWomen ?? -1) + 1 : 0,
          shopSortKids: audience === 'kids' ? (maxAud._max.shopSortKids ?? -1) + 1 : 0,
          variants: { create: variantWrites(variants) },
        },
      });
      created += 1;
      console.log(
        `OK ${parentCode} — ${variants.length} children, stock ${stock}, photos ${allPhotos.length}`
      );
    } catch (err) {
      errors.push({ itemCode: parentCode, message: err.message });
      console.error('FAIL', parentCode, err.message);
    }
  }

  cache.invalidate('products');
  cache.invalidate('product');
  console.log(
    JSON.stringify(
      { created, failed: errors.length, errors: errors.slice(0, 30) },
      null,
      2
    )
  );
  process.exit(errors.length && !created ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
