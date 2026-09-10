/**
 * Wipe catalog products and import from a Shopify products_export CSV.
 *
 * Usage:
 *   node scripts/import-shopify-csv.js [path-to-csv]
 *
 * Defaults to %USERPROFILE%/Downloads/products_export_1.csv
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { ensureDefaultCategories, TYPE_TO_SLUG } = require('../utils/catalog');

const prisma = new PrismaClient();

const csvPath =
  process.argv[2] ||
  path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'products_export_1.csv');

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

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function colorFromTitle(title) {
  const t = String(title || '').trim();
  const m = t.match(/,\s*([^,]+)$/);
  if (!m) return null;
  const color = m[1].trim();
  if (!color || color.length > 40) return null;
  return color;
}

function mapAudience(tags, title, type) {
  const hay = `${tags} ${title} ${type}`.toLowerCase();
  if (
    /\bbaby\b/.test(hay) ||
    /\bkids?\b/.test(hay) ||
    /\bgirls?\b/.test(hay) ||
    /\bboy'?s?\b/.test(hay) ||
    /unisex kid/.test(hay)
  ) {
    return 'kids';
  }
  if (/\bwomen\b/.test(hay) || /\bwoman\b/.test(hay) || /\bpanty\b/.test(hay)) {
    return 'women';
  }
  return 'men';
}

function mapType(shopifyType, title, tags) {
  const t = String(shopifyType || '').toLowerCase();
  const hay = `${t} ${title} ${tags}`.toLowerCase();

  if (/sock/.test(hay)) return 'socks';
  if (/bundle|bunldle|pack of|offer/.test(hay) && /pack|bundle|set|offer/.test(hay)) {
    if (/undershirt|t-?shirt|top/.test(hay) && !/pack of/.test(hay)) {
      /* fall through */
    } else if (/bundle|bunldle|offers|underwear set|pack of/.test(t) || /pack of/.test(hay)) {
      return 'bundle';
    }
  }
  if (/bunldle|bundle/.test(t) || /underwear set/.test(t)) return 'bundle';
  if (/pack of/.test(hay)) return 'bundle';
  if (/undershirt/.test(hay)) return 'undershirt';
  if (/trunk/.test(hay)) return 'trunks';
  if (/brief|panty/.test(hay)) return 'briefs';
  if (/boxer/.test(hay)) return 'boxers';
  if (/t-?shirt|hoodie|thermal|sweat|sleep|top|spaghetti/.test(hay)) return 'undershirt';
  if (/pant|short/.test(hay)) return 'boxers';
  if (/sock/.test(t)) return 'socks';
  return 'boxers';
}

function mapCategorySlug(type, audience) {
  if (audience === 'men') return TYPE_TO_SLUG[type] || 'boxers';
  if (audience === 'women') {
    if (type === 'briefs' || type === 'boxers' || type === 'trunks') return 'underwear';
    if (type === 'bundle') return 'underwear';
    if (type === 'socks') return 'bottoms';
    return 'tops';
  }
  // kids
  if (type === 'briefs' || type === 'boxers' || type === 'trunks' || type === 'bundle') {
    return 'underwear';
  }
  if (type === 'socks') return 'bottoms';
  return 'tops';
}

async function wipeCatalog() {
  console.log('Deleting existing catalog (and order lines that reference products)…');
  // Order of deletes respects FKs
  await prisma.problemRequest.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.productSize.deleteMany({});
  await prisma.product.deleteMany({});
  console.log('Catalog cleared.');
}

function buildProductsFromCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = parseCSV(text);
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

  const products = [];
  for (const [, list] of byHandle) {
    const titleRow = list.find((r) => get(r, 'Title')) || list[0];
    const status = (get(titleRow, 'Status') || '').toLowerCase();
    if (status !== 'active') continue;

    const title = get(titleRow, 'Title').trim();
    if (!title) continue;

    const tags = get(titleRow, 'Tags');
    const shopifyType = get(titleRow, 'Type');
    const audience = mapAudience(tags, title, shopifyType);
    const type = mapType(shopifyType, title, tags);
    const description =
      stripHtml(get(titleRow, 'Body (HTML)')) || `${title} — FutureFit essential.`;

    // Images: all rows with Image Src, ordered by position
    const photos = [];
    const seenPhoto = new Set();
    const withImg = [...list]
      .filter((r) => get(r, 'Image Src'))
      .sort(
        (a, b) =>
          (Number(get(a, 'Image Position')) || 99) - (Number(get(b, 'Image Position')) || 99)
      );
    for (const r of withImg) {
      const src = get(r, 'Image Src').split('?')[0];
      if (!src || seenPhoto.has(src)) continue;
      seenPhoto.add(src);
      photos.push(get(r, 'Image Src'));
    }

    // Variants / sizes
    const optName = get(titleRow, 'Option1 Name');
    const sizeMap = new Map();
    let price = 0;
    let compareAt = 0;

    if (optName === 'Size') {
      for (const r of list) {
        const size = get(r, 'Option1 Value').trim();
        if (!size) continue;
        const qty = Number(get(r, 'Variant Inventory Qty'));
        const stock = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;
        const vp = Number(get(r, 'Variant Price'));
        const cp = Number(get(r, 'Variant Compare At Price'));
        if (Number.isFinite(vp) && vp > 0) {
          if (!price || vp < price) price = vp;
          if (Number.isFinite(cp) && cp > compareAt) compareAt = cp;
        }
        if (!sizeMap.has(size)) sizeMap.set(size, stock);
        else sizeMap.set(size, sizeMap.get(size) + stock);
      }
    } else {
      // Single "Title" variant (or default)
      for (const r of list) {
        const vp = Number(get(r, 'Variant Price'));
        const cp = Number(get(r, 'Variant Compare At Price'));
        const qty = Number(get(r, 'Variant Inventory Qty'));
        if (Number.isFinite(vp) && vp > 0) {
          price = vp;
          if (Number.isFinite(cp) && cp > 0) compareAt = cp;
          const stock = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;
          sizeMap.set('One Size', stock);
          break;
        }
      }
      if (!sizeMap.size) sizeMap.set('One Size', 0);
    }

    if (!price) {
      // fallback: first numeric price on any row
      for (const r of list) {
        const vp = Number(get(r, 'Variant Price'));
        if (Number.isFinite(vp) && vp > 0) {
          price = vp;
          const cp = Number(get(r, 'Variant Compare At Price'));
          if (Number.isFinite(cp) && cp > 0) compareAt = cp;
          break;
        }
      }
    }
    if (!price) continue; // skip unusable

    const isSale = compareAt > price;
    const regularPrice = isSale ? compareAt : price;
    const salePrice = isSale ? price : null;

    const color =
      get(titleRow, 'Color (product.metafields.shopify.color-pattern)').trim() ||
      colorFromTitle(title);
    const colors = color ? [color] : [];
    const photoByColor =
      color && photos.length
        ? { [color]: photos.length === 1 ? photos[0] : photos }
        : null;

    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', 'One Size'];
    const sizes = [...sizeMap.keys()].sort((a, b) => {
      const ia = sizeOrder.indexOf(a.toUpperCase());
      const ib = sizeOrder.indexOf(b.toUpperCase());
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    const sizeStocks = sizes.map((size, i) => ({
      size,
      stock: sizeMap.get(size) || 0,
      sortOrder: i,
    }));
    const stock = sizeStocks.reduce((n, s) => n + s.stock, 0);

    products.push({
      name: title,
      description,
      price: regularPrice,
      type,
      audience,
      photos: photos.length ? photos : [],
      colors,
      photoByColor,
      sizes,
      stock,
      isSaleActive: isSale,
      salePrice,
      sizeStocks,
      _categorySlug: mapCategorySlug(type, audience),
    });
  }

  return products;
}

async function main() {
  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }
  console.log('Reading', csvPath);

  await ensureDefaultCategories(prisma);
  const categories = await prisma.category.findMany();
  const byKey = Object.fromEntries(categories.map((c) => [`${c.audience}:${c.slug}`, c]));

  const products = buildProductsFromCsv(csvPath);
  console.log(`Parsed ${products.length} active products from Shopify export.`);

  await wipeCatalog();

  let created = 0;
  for (const p of products) {
    const cat = byKey[`${p.audience}:${p._categorySlug}`] || byKey[`men:${TYPE_TO_SLUG[p.type] || 'boxers'}`];
    const { _categorySlug, sizeStocks, ...data } = p;
    await prisma.product.create({
      data: {
        ...data,
        categoryId: cat?.id || null,
        sizeStocks: { create: sizeStocks },
      },
    });
    created += 1;
    if (created % 50 === 0) console.log(`  … ${created}/${products.length}`);
  }

  const count = await prisma.product.count();
  console.log(`Done. Imported ${created} products. DB product count: ${count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
