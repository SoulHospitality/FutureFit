/**
 * Merge same-style colour variants into one product (colors[] + photoByColor).
 * Also collapses same-colour duplicates and cleans colour labels.
 *
 * Usage: node scripts/merge-product-colors.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const cache = require('../lib/cache');

const prisma = new PrismaClient();

const COLOR_WORDS =
  'Off White|Off-White|OffWhite|Dark Green|Mint Green|Sky Blue|Light Blue|Dark Blue|Light Grey|Dark Grey|Light Gray|Dark Gray|Dark Red|DarkGrey|MintGreen|MultiColoure|MultiColour|Multicolor|Multi.?color|Charcoal|Burgundy|Lavender|Mustard|Natural|Indigo|Ivory|Olive|Purple|Yellow|Orange|Maroon|Khaki|Coral|Teal|Camel|Silver|Cream|Beige|Biege|Rose|Pink|Navy|White|Black|Grey|Gray|Green|Brown|Nude|Skin|Mint|Wine|Tan|Gold|Sand|Rust|Red|Blue';

const AUDIENCE_TAIL =
  /\s*(?:,\s*)?(?:for\s*)?(?:men|women|woman|boys?\s*&\s*girls?|girls?\s*&\s*boys?|boys?|girls?|kids?|unisex|baby)(?:\s*&\s*(?:kids?|girls?|boys?))?\s*$/i;
const MATERIAL_TAIL = /\s*(?:,\s*)?(?:cotton\s*100%?|100%\s*cotton)\s*$/i;
const PACK_TAIL = /\s*\([^)]*t-?shirt\s*\+?\s*pants[^)]*\)\s*$/i;

const COLOR_RE_END = new RegExp(`\\b(${COLOR_WORDS})\\s*$`, 'i');
const COLOR_RE_COMMA = new RegExp(`,\\s*(${COLOR_WORDS})\\s*$`, 'i');
const COLOR_RE_IN = new RegExp(`\\bin\\s+(${COLOR_WORDS})\\s*$`, 'i');
const COLOR_RE_ANY = new RegExp(`\\b(${COLOR_WORDS})\\b`, 'i');
const COLOR_RE_PLAIN_BOXER = new RegExp(`^Plain\\s+(${COLOR_WORDS})\\s+Boxer\\b`, 'i');
const COLOR_RE_SLEEP = new RegExp(`Sleep\\s*Wear\\s+(${COLOR_WORDS})\\b`, 'i');
const COLOR_RE_MID = new RegExp(`\\s+(${COLOR_WORDS})\\s+(?:Boxer|UnderShirt|Undershirt|Hoodie|Pants|Socks)\\b`, 'i');

function normalizeColor(raw) {
  if (!raw) return null;
  let c = String(raw).trim().replace(/\s+/g, ' ');
  c = c.replace(/^biege$/i, 'Beige');
  c = c.replace(/^multi[\s-]?colou?re?$/i, 'Multicolor');
  c = c.replace(/^off[\s-]?white$/i, 'Off White');
  c = c.replace(/^darkgrey$/i, 'Dark Grey');
  c = c.replace(/^darkgray$/i, 'Dark Grey');
  c = c.replace(/^mintgreen$/i, 'Mint');
  c = c.replace(/^mint green$/i, 'Mint');
  c = c.replace(/^dark green$/i, 'Dark Green');
  c = c.replace(/^grey$/i, 'Grey');
  c = c.replace(/^gray$/i, 'Grey');
  c = c.replace(/^light$/i, null);
  if (!c) return null;
  return c
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function cleanColorLabel(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^default$/i.test(s)) return null;
  const glued = s.replace(/([a-z])([A-Z])/g, '$1 $2');
  const direct = normalizeColor(glued);
  if (direct && !/\bfor\b/i.test(direct) && !/cotton/i.test(direct) && direct.length <= 24) {
    const check = direct.match(COLOR_RE_ANY);
    if (check && normalizeColor(check[1]) === direct) return direct;
  }
  const m = glued.match(COLOR_RE_ANY);
  return m ? normalizeColor(m[1]) : null;
}

function stripAudience(title) {
  let t = String(title || '').trim();
  for (let i = 0; i < 5; i++) {
    const next = t
      .replace(/\s+ForWomen\b/gi, '')
      .replace(/\s+ForMen\b/gi, '')
      .replace(PACK_TAIL, '')
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
  const raw = String(title || '').trim();
  // Plain {color} Boxer
  const plain = raw.match(COLOR_RE_PLAIN_BOXER);
  if (plain) return normalizeColor(plain[1]);
  // Sleep Wear {color}
  const sleep = raw.match(COLOR_RE_SLEEP);
  if (sleep) return normalizeColor(sleep[1]);

  let t = stripAudience(raw);
  // Strip trailing "Light" variant word then re-check
  t = t.replace(/\s+Light\s*$/i, '').trim();

  const m1 = t.match(COLOR_RE_COMMA);
  if (m1) return normalizeColor(m1[1]);
  const mIn = t.match(COLOR_RE_IN);
  if (mIn) return normalizeColor(mIn[1]);
  const m2 = t.match(COLOR_RE_END);
  if (m2) return normalizeColor(m2[1]);
  const mid = t.match(COLOR_RE_MID);
  if (mid) return normalizeColor(mid[1]);
  const m3 = raw.match(new RegExp(`\\b(${COLOR_WORDS})\\s*$`, 'i'));
  if (m3) return normalizeColor(m3[1]);
  const m4 = raw.match(new RegExp(`\\b(${COLOR_WORDS})\\s+for\\b`, 'i'));
  if (m4) return normalizeColor(m4[1]);
  // Glued colour tokens in the title (DarkGrey, MintGreen, OffWhite)
  const glued = raw.match(/\b(DarkGrey|DarkGray|MintGreen|OffWhite|SkyBlue)\b/i);
  if (glued) return normalizeColor(glued[1]);
  return cleanColorLabel(raw);
}

function normalizeBaseTypos(name) {
  return String(name || '')
    .replace(/\bSeleeve\b/gi, 'Sleeve')
    .replace(/\bSeeleve\b/gi, 'Sleeve')
    .replace(/\bSeeve\b/gi, 'Sleeve')
    .replace(/\bUnderWear\b/gi, 'Underwear')
    .replace(/\bUnderShirt\b/gi, 'Undershirt')
    .replace(/\bKid'?s+s\b/gi, "Kids")
    .replace(/\s+/g, ' ')
    .trim();
}

function baseName(title) {
  let t = normalizeBaseTypos(stripAudience(title));
  // Plain {color} Boxer → Plain Boxer
  t = t.replace(COLOR_RE_PLAIN_BOXER, 'Plain Boxer');
  // Sleep Wear {color} … → Sleep Wear
  t = t.replace(COLOR_RE_SLEEP, 'Sleep Wear');
  t = t.replace(/\b(DarkGrey|DarkGray|MintGreen|OffWhite|SkyBlue)\b/gi, '');
  t = t
    .replace(COLOR_RE_COMMA, '')
    .replace(COLOR_RE_IN, '')
    .replace(COLOR_RE_MID, ' ')
    .replace(COLOR_RE_END, '')
    .replace(/\s+Light\s*$/i, '')
    .replace(/\s+Multicolor\b/gi, '')
    .replace(/\s*,\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

function groupKey(p) {
  const base = baseName(p.name).toLowerCase();
  // Don't split colour variants across sibling subcategories of the same department
  return `${p.audience || 'men'}::${p.type || 'boxers'}::${base}`;
}

function displayName(title) {
  return baseName(title) || title;
}

function mergePhotoMap(target, color, photos, existingMap) {
  const c = color;
  if (photos?.length) {
    const existing = target[c];
    if (!existing) {
      target[c] = photos.length === 1 ? photos[0] : photos;
    } else {
      const prev = Array.isArray(existing) ? existing : [existing];
      const merged = [...prev];
      for (const url of photos) {
        if (!merged.includes(url)) merged.push(url);
      }
      target[c] = merged.length === 1 ? merged[0] : merged;
    }
  } else if (existingMap && typeof existingMap === 'object') {
    for (const [rawKey, mapped] of Object.entries(existingMap)) {
      const key = cleanColorLabel(rawKey) || c;
      if (!target[key]) target[key] = mapped;
    }
  }
}

async function mergeGroup(annotated, { forceSameColor = false } = {}) {
  const list = annotated.map((a) => a.p);
  const keeperAnno = [...annotated].sort((a, b) => {
    const ca = (a.p.colors || []).length;
    const cb = (b.p.colors || []).length;
    if (cb !== ca) return cb - ca;
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
    // Prefer title colour; then existing multi-colour maps on the product
    if (p.photoByColor && typeof p.photoByColor === 'object' && Object.keys(p.photoByColor).length > 1) {
      for (const [rawKey, mapped] of Object.entries(p.photoByColor)) {
        const key = cleanColorLabel(rawKey) || color || 'Default';
        if (!colors.includes(key)) colors.push(key);
        if (!photoByColor[key]) photoByColor[key] = mapped;
        const urls = Array.isArray(mapped) ? mapped : [mapped];
        for (const url of urls.filter(Boolean)) {
          if (!allPhotos.includes(url)) allPhotos.push(url);
        }
      }
    }

    const c = color || cleanColorLabel(p.colors?.[0]) || (forceSameColor ? 'Multicolor' : null) || `Variant ${colors.length + 1}`;
    if (!colors.includes(c)) colors.push(c);
    const photos = (p.photos || []).filter(Boolean);
    mergePhotoMap(photoByColor, c, photos, p.photoByColor);
    for (const url of photos) {
      if (!allPhotos.includes(url)) allPhotos.push(url);
    }

    for (const row of p.sizeStocks || []) {
      sizeStockMap.set(row.size, (sizeStockMap.get(row.size) || 0) + (Number(row.stock) || 0));
    }
    totalStock += Number(p.stock) || 0;

    if ((p.description || '').length > (description || '').length) description = p.description;
    const pPrice = Number(p.price);
    if (pPrice > 0 && (price <= 0 || pPrice < price)) price = pPrice;
    if (p.isSaleActive && p.salePrice != null) {
      isSaleActive = true;
      const sp = Number(p.salePrice);
      if (salePrice == null || sp < salePrice) salePrice = sp;
    }
  }

  // Drop useless Default if real colours exist
  const cleanedColors = colors.filter((c) => c && !/^default$/i.test(c) && !/^variant\s/i.test(c));
  const finalColors = cleanedColors.length ? cleanedColors : colors;
  const finalMap = {};
  for (const c of finalColors) {
    if (photoByColor[c] != null) finalMap[c] = photoByColor[c];
  }
  // Keep any leftover mapped colours
  for (const [k, v] of Object.entries(photoByColor)) {
    if (!finalMap[k] && !/^default$/i.test(k)) {
      finalColors.push(k);
      finalMap[k] = v;
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
        colors: finalColors,
        photos: allPhotos.length ? allPhotos : keeper.photos,
        photoByColor: Object.keys(finalMap).length ? finalMap : photoByColor,
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

  return { deleted: deleteIds.length, name: displayName(keeper.name), colors: finalColors };
}

async function main() {
  const products = await prisma.product.findMany({
    include: { sizeStocks: true, category: { select: { id: true, slug: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const groups = new Map();
  for (const p of products) {
    const key = groupKey(p);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  let mergedGroups = 0;
  let dedupedGroups = 0;
  let deleted = 0;
  let updatedSingles = 0;
  const samples = [];

  for (const [, list] of groups) {
    const annotated = list.map((p) => {
      const fromTitle = colorFromTitle(p.name);
      const fromArr = p.colors?.[0] ? cleanColorLabel(p.colors[0]) : null;
      // If product already has multiple clean colours, keep first for grouping annotate
      const fromMulti = (p.colors || []).map(cleanColorLabel).filter(Boolean);
      const color = fromTitle || fromArr || fromMulti[0] || null;
      return { p, color, fromMulti };
    });

    const distinct = [
      ...new Set(annotated.map((a) => a.color).filter(Boolean)),
    ];
    // Also count colours already on multi products
    for (const a of annotated) {
      for (const c of a.fromMulti || []) {
        if (c && !distinct.includes(c)) distinct.push(c);
      }
    }

    if (list.length >= 2 && distinct.length >= 2) {
      const result = await mergeGroup(annotated);
      mergedGroups += 1;
      deleted += result.deleted;
      if (samples.length < 12) samples.push(`MERGE ${result.name} → ${result.colors.join(', ')}`);
      continue;
    }

    // Only dedupe when every item shares one real colour (not Multicolor/Default dumps)
    const realColors = distinct.filter(
      (c) => c && !/^multicolor$/i.test(c) && !/^default$/i.test(c) && !/^variant\s/i.test(c)
    );
    if (list.length >= 2 && realColors.length === 1 && distinct.length === 1) {
      const result = await mergeGroup(annotated, { forceSameColor: true });
      dedupedGroups += 1;
      deleted += result.deleted;
      if (samples.length < 18) samples.push(`DEDUP ${result.name} (${list.length} → 1)`);
      continue;
    }

    // Singles: clean colour + photoByColor
    for (const { p, color } of annotated) {
      const c = color || (p.colors?.[0] ? cleanColorLabel(p.colors[0]) : null);
      if (!c && !(p.photos || []).length) continue;

      const nextColor = c || 'Default';
      const photos = p.photos || [];
      const cleanedExisting = (p.colors || []).map(cleanColorLabel).filter(Boolean);
      const needsColor =
        !cleanedExisting.length ||
        cleanedExisting.some((x, i) => x !== (p.colors || [])[i]) ||
        (p.colors || []).some((x) => /\bfor\b|cotton|default/i.test(x));
      const needsMap =
        !p.photoByColor ||
        !Object.keys(p.photoByColor).length ||
        Object.keys(p.photoByColor).some((k) => /\bfor\b|cotton|default/i.test(k)) ||
        (c && !p.photoByColor[c] && !p.photoByColor[nextColor]);
      const needsName = c && displayName(p.name) !== p.name;

      if (!needsColor && !needsMap && !needsName) continue;

      const remapped = {};
      if (p.photoByColor && typeof p.photoByColor === 'object') {
        for (const [rawKey, mapped] of Object.entries(p.photoByColor)) {
          const key = cleanColorLabel(rawKey) || nextColor;
          remapped[key] = mapped;
        }
      }
      if (photos.length > 0 && !remapped[nextColor]) {
        remapped[nextColor] = photos.length === 1 ? photos[0] : photos;
      }

      const colorList = Object.keys(remapped).length
        ? Object.keys(remapped)
        : cleanedExisting.length
          ? cleanedExisting
          : [nextColor];

      await prisma.product.update({
        where: { id: p.id },
        data: {
          name: c ? displayName(p.name) : p.name,
          colors: colorList,
          photoByColor: Object.keys(remapped).length
            ? remapped
            : { [nextColor]: photos.length === 1 ? photos[0] : photos },
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
  const multi = await prisma.product.count({
    where: { colors: { isEmpty: false } },
  });
  console.log(
    JSON.stringify(
      {
        mergedColorGroups: mergedGroups,
        dedupedGroups,
        deletedDuplicates: deleted,
        updatedSingles,
        productsRemaining: remaining,
        samples,
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
