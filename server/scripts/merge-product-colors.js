/**
 * Merge catalog products that are the same style in different colours
 * into one product with colors[] + photoByColor, then fix singles missing colour.
 *
 * Usage: node scripts/merge-product-colors.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const cache = require('../lib/cache');

const prisma = new PrismaClient();

const COLOR_WORDS =
  'White|Black|Grey|Gray|Navy|Red|Blue|Green|Beige|Biege|Rose|Pink|Multicolor|MultiColoure|MultiColour|Multi.?color|Dark Red|Charcoal|Brown|Cream|Ivory|Olive|Purple|Yellow|Orange|Maroon|Burgundy|Khaki|Sky Blue|Light Blue|Dark Blue|Light Grey|Dark Grey|Light Gray|Dark Gray|Nude|Skin|Mint|Lavender|Wine|Camel|Tan|Gold|Silver|Coral|Teal|Mustard|Off White|Off-White|Natural|Sand|Rust|Indigo';

const AUDIENCE_TAIL =
  /\s*(?:,\s*)?(?:for\s*)?(?:men|women|woman|boys?|girls?|kids?|unisex|baby)(?:\s*&\s*(?:kids?|girls?|boys?))?\s*$/i;

const MATERIAL_TAIL = /\s*(?:,\s*)?(?:cotton\s*100%?|100%\s*cotton)\s*$/i;

const COLOR_RE_END = new RegExp(`\\b(${COLOR_WORDS})\\s*$`, 'i');
const COLOR_RE_COMMA = new RegExp(`,\\s*(${COLOR_WORDS})\\s*$`, 'i');
const COLOR_RE_IN = new RegExp(`\\bin\\s+(${COLOR_WORDS})\\s*$`, 'i');
const COLOR_RE_ANY = new RegExp(`\\b(${COLOR_WORDS})\\b`, 'i');

function normalizeColor(raw) {
  if (!raw) return null;
  let c = String(raw).trim().replace(/\s+/g, ' ');
  c = c.replace(/^biege$/i, 'Beige');
  c = c.replace(/^multi[\s-]?colou?re?$/i, 'Multicolor');
  c = c.replace(/^grey$/i, 'Grey');
  c = c.replace(/^gray$/i, 'Grey');
  // Title-case
  return c
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Pull a clean colour from messy labels like "Black For Men Cotton 100%". */
function cleanColorLabel(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^default$/i.test(s)) return null;
  const direct = normalizeColor(s);
  if (direct && !/\bfor\b/i.test(direct) && !/cotton/i.test(direct) && direct.length <= 24) {
    const check = direct.match(COLOR_RE_ANY);
    if (check && normalizeColor(check[1]) === direct) return direct;
  }
  const m = s.match(COLOR_RE_ANY);
  return m ? normalizeColor(m[1]) : null;
}

/** Strip trailing audience / material phrases so colour can be read from the end. */
function stripAudience(title) {
  let t = String(title || '').trim();
  for (let i = 0; i < 4; i++) {
    const next = t
      .replace(/\s+ForWomen\b/gi, '')
      .replace(/\s+ForMen\b/gi, '')
      .replace(MATERIAL_TAIL, '')
      .replace(AUDIENCE_TAIL, '')
      .replace(/\s*,\s*$/, '')
      .trim();
    if (next === t) break;
    t = next;
  }
  return t;
}

function colorFromTitle(title) {
  let t = stripAudience(title);
  const m1 = t.match(COLOR_RE_COMMA);
  if (m1) return normalizeColor(m1[1]);
  const mIn = t.match(COLOR_RE_IN);
  if (mIn) return normalizeColor(mIn[1]);
  const m2 = t.match(COLOR_RE_END);
  if (m2) return normalizeColor(m2[1]);
  const m3 = String(title || '').match(new RegExp(`\\b(${COLOR_WORDS})\\s*$`, 'i'));
  if (m3) return normalizeColor(m3[1]);
  // Embedded colour before audience: "… Black For men …"
  const m4 = String(title || '').match(new RegExp(`\\b(${COLOR_WORDS})\\s+for\\b`, 'i'));
  if (m4) return normalizeColor(m4[1]);
  return cleanColorLabel(title);
}

function baseName(title) {
  let t = stripAudience(title);
  t = t
    .replace(COLOR_RE_COMMA, '')
    .replace(COLOR_RE_IN, '')
    .replace(COLOR_RE_END, '')
    .replace(/\s*,\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

function groupKey(p) {
  const base = baseName(p.name).toLowerCase();
  return `${p.audience || 'men'}::${p.type || 'boxers'}::${base}`;
}

function displayName(title) {
  const base = baseName(title);
  return base || title;
}

async function main() {
  const products = await prisma.product.findMany({
    include: { sizeStocks: true },
    orderBy: { createdAt: 'asc' },
  });

  const groups = new Map();
  for (const p of products) {
    const key = groupKey(p);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  let mergedGroups = 0;
  let deleted = 0;
  let updatedSingles = 0;

  for (const [, list] of groups) {
    // Annotate colors
    const annotated = list.map((p) => {
      const fromTitle = colorFromTitle(p.name);
      const fromArr = p.colors?.[0] ? cleanColorLabel(p.colors[0]) : null;
      const color = fromTitle || fromArr || null;
      return { p, color };
    });

    const withDistinctColors = annotated.filter((a) => a.color);
    const uniqueColors = [...new Set(withDistinctColors.map((a) => a.color))];

    // Merge only when 2+ products share base and have distinct colours
    if (list.length >= 2 && uniqueColors.length >= 2) {
      // Pick keeper: most photos, then earliest
      const keeperAnno = [...annotated].sort((a, b) => {
        const pa = a.p.photos?.length || 0;
        const pb = b.p.photos?.length || 0;
        if (pb !== pa) return pb - pa;
        return new Date(a.p.createdAt) - new Date(b.p.createdAt);
      })[0];
      const keeper = keeperAnno.p;

      const photoByColor = {};
      const colors = [];
      const allPhotos = [];
      const sizeStockMap = new Map();
      let totalStock = 0;
      let price = Number(keeper.price);
      let salePrice = keeper.salePrice != null ? Number(keeper.salePrice) : null;
      let isSaleActive = keeper.isSaleActive;
      let description = keeper.description;

      for (const { p, color } of annotated) {
        const c = color || `Variant ${colors.length + 1}`;
        if (!colors.includes(c)) colors.push(c);
        // Prefer this product's photos; remap existing photoByColor keys to clean names
        const photos = (p.photos || []).filter(Boolean);
        if (photos.length) {
          const existing = photoByColor[c];
          if (!existing) {
            photoByColor[c] = photos.length === 1 ? photos[0] : photos;
          } else {
            const prev = Array.isArray(existing) ? existing : [existing];
            const merged = [...prev];
            for (const url of photos) {
              if (!merged.includes(url)) merged.push(url);
            }
            photoByColor[c] = merged.length === 1 ? merged[0] : merged;
          }
          for (const url of photos) {
            if (!allPhotos.includes(url)) allPhotos.push(url);
          }
        } else if (p.photoByColor && typeof p.photoByColor === 'object') {
          for (const [rawKey, mapped] of Object.entries(p.photoByColor)) {
            const key = cleanColorLabel(rawKey) || c;
            if (!photoByColor[key]) photoByColor[key] = mapped;
            if (!colors.includes(key)) colors.push(key);
            const urls = Array.isArray(mapped) ? mapped : [mapped];
            for (const url of urls.filter(Boolean)) {
              if (!allPhotos.includes(url)) allPhotos.push(url);
            }
          }
        }

        for (const row of p.sizeStocks || []) {
          const prev = sizeStockMap.get(row.size) || 0;
          sizeStockMap.set(row.size, prev + (Number(row.stock) || 0));
        }
        totalStock += Number(p.stock) || 0;

        // Prefer longer description / better sale info
        if ((p.description || '').length > (description || '').length) {
          description = p.description;
        }
        const pPrice = Number(p.price);
        if (pPrice > 0 && pPrice < price) price = pPrice;
        if (p.isSaleActive && p.salePrice != null) {
          isSaleActive = true;
          const sp = Number(p.salePrice);
          if (salePrice == null || sp < salePrice) salePrice = sp;
        }
      }

      const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', 'One Size'];
      const sizes = [...sizeStockMap.keys()].sort((a, b) => {
        const ia = sizeOrder.indexOf(a.toUpperCase());
        const ib = sizeOrder.indexOf(b.toUpperCase());
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });

      const deleteIds = list.filter((p) => p.id !== keeper.id).map((p) => p.id);

      await prisma.$transaction(async (tx) => {
        // Point order items at keeper so we can delete siblings
        if (deleteIds.length) {
          await tx.orderItem.updateMany({
            where: { productId: { in: deleteIds } },
            data: { productId: keeper.id },
          });
          await tx.review.updateMany({
            where: { productId: { in: deleteIds } },
            data: { productId: keeper.id },
          });
          await tx.productSize.deleteMany({ where: { productId: { in: deleteIds } } });
          await tx.product.deleteMany({ where: { id: { in: deleteIds } } });
        }

        await tx.productSize.deleteMany({ where: { productId: keeper.id } });
        await tx.product.update({
          where: { id: keeper.id },
          data: {
            name: displayName(keeper.name),
            description,
            price,
            salePrice,
            isSaleActive,
            colors,
            photos: allPhotos.length ? allPhotos : keeper.photos,
            photoByColor,
            sizes,
            stock: sizes.length
              ? [...sizeStockMap.values()].reduce((a, b) => a + b, 0)
              : totalStock,
            sizeStocks: {
              create: sizes.map((size, i) => ({
                size,
                stock: sizeStockMap.get(size) || 0,
                sortOrder: i,
              })),
            },
          },
        });
      });

      mergedGroups += 1;
      deleted += deleteIds.length;
      continue;
    }

    // Singles / same-colour duplicates: at least set colors + photoByColor
    for (const { p, color } of annotated) {
      const c = color || (p.colors?.[0] ? cleanColorLabel(p.colors[0]) : null);
      if (!c && !(p.photos || []).length) continue;

      const nextColor = c || 'Default';
      const photos = p.photos || [];
      const cleanedExisting = (p.colors || []).map(cleanColorLabel).filter(Boolean);
      const needsColor =
        !cleanedExisting.length ||
        cleanedExisting.length !== (p.colors || []).length ||
        cleanedExisting[0] !== nextColor ||
        (p.colors || []).some((x) => /\bfor\b|cotton/i.test(x));
      const needsMap =
        !p.photoByColor ||
        !Object.keys(p.photoByColor).length ||
        Object.keys(p.photoByColor).some((k) => /\bfor\b|cotton/i.test(k)) ||
        (c && !p.photoByColor[c] && !p.photoByColor[nextColor]);

      if (!needsColor && !needsMap) continue;

      let photoByColor = p.photoByColor && typeof p.photoByColor === 'object' ? { ...p.photoByColor } : {};
      // Remap messy keys
      const remapped = {};
      for (const [rawKey, mapped] of Object.entries(photoByColor)) {
        const key = cleanColorLabel(rawKey) || nextColor;
        remapped[key] = mapped;
      }
      if (photos.length > 0 && !remapped[nextColor]) {
        remapped[nextColor] = photos.length === 1 ? photos[0] : photos;
      }
      if (!Object.keys(remapped).length && photos.length) {
        remapped[nextColor] = photos.length === 1 ? photos[0] : photos;
      }

      await prisma.product.update({
        where: { id: p.id },
        data: {
          name: c ? displayName(p.name) : p.name,
          colors: Object.keys(remapped).length ? Object.keys(remapped) : [nextColor],
          photoByColor: Object.keys(remapped).length ? remapped : { [nextColor]: photos },
        },
      });
      updatedSingles += 1;
    }
  }

  try {
    cache.invalidate('products');
    cache.invalidate('product');
  } catch {
    /* optional */
  }

  const remaining = await prisma.product.count();
  console.log(
    JSON.stringify(
      {
        mergedGroups,
        deletedDuplicates: deleted,
        updatedSingles,
        productsRemaining: remaining,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
