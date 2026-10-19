const prisma = require('../lib/prisma');
const { resolvePhotoLinks } = require('./drivePhotos');
const { typeFromCategory, shopSortFieldFor } = require('./catalog');
const { cleanItemCode } = require('./itemCode');
const {
  normalizeVariants,
  variantWrites,
  colorsFromVariants,
  sizesFromVariants,
  photoByColorFromVariants,
  uniformChildPrice,
} = require('./variants');

const softResolvePhotos = async (links = []) => {
  const cleaned = (Array.isArray(links) ? links : [links])
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  if (!cleaned.length) return [];
  try {
    return await resolvePhotoLinks(cleaned);
  } catch {
    return [];
  }
};

const parseMoney = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Math.round(Number(value) * 100) / 100;
  return Number.isFinite(n) ? n : null;
};

const prepareVariantRows = async (rawVariants = []) => {
  const prepared = [];
  for (const row of rawVariants) {
    const photos = await softResolvePhotos([
      ...(Array.isArray(row.photos) ? row.photos : []),
      row.driveFolder || row.drive_folder || '',
    ]);
    prepared.push({
      ...row,
      itemCode: row.itemCode ?? row.item_id,
      photos,
    });
  }
  return normalizeVariants({ variants: prepared });
};

/**
 * Create or update a parent product and its children by Item ID.
 * Existing parents/children are updated; missing ones are created.
 * Children not present in the payload are left untouched.
 */
const upsertParentWithVariants = async (body, { resolveAudienceAndCategory }) => {
  const parentCode = cleanItemCode(body.itemCode ?? body.item_id);
  if (!parentCode) {
    const err = new Error('Parent Item ID is required');
    err.status = 400;
    throw err;
  }

  let variantRows = await prepareVariantRows(body.variants || []);
  if (!variantRows.length) {
    const err = new Error('Add at least one child variant (color + size + Item ID)');
    err.status = 400;
    throw err;
  }

  // Avoid unique clash when a standalone parent is also its only child code
  const used = new Set([parentCode]);
  variantRows = variantRows.map((row) => {
    let code = row.itemCode;
    if (used.has(code)) {
      code = cleanItemCode(`${code}-${row.size}`) || `${parentCode}-V`;
      let n = 2;
      while (used.has(code)) {
        code = `${parentCode}-V${n}`;
        n += 1;
      }
    }
    used.add(code);
    return { ...row, itemCode: code };
  });

  const childPrices = variantRows.map((v) => v.price).filter((p) => p != null && p > 0);
  const bodyPrice = parseMoney(body.price);
  const uniformPrice = uniformChildPrice(variantRows);
  // When every child shares one price, parent must match; else sheet/min fallback.
  const parentPrice =
    uniformPrice != null
      ? uniformPrice
      : bodyPrice != null && bodyPrice > 0
        ? bodyPrice
        : childPrices.length
          ? Math.min(...childPrices)
          : null;

  const { audience, categoryId, type } = await resolveAudienceAndCategory(body);
  const category = categoryId
    ? await prisma.category.findUnique({ where: { id: categoryId } })
    : null;

  const parentPhotos = await softResolvePhotos([
    ...(Array.isArray(body.photos) ? body.photos : []),
    body.driveFolder || body.drive_folder || '',
    ...variantRows.flatMap((v) => v.photos || []),
  ]);
  const uniquePhotos = [...new Set(parentPhotos)].slice(0, 24);

  const colors = colorsFromVariants(variantRows);
  const sizes = sizesFromVariants(variantRows);
  const photoByColor = photoByColorFromVariants(variantRows);
  const stock = variantRows.reduce((n, v) => n + v.stock, 0);
  const isSaleActive = Boolean(body.isSaleActive);
  const salePrice = parseMoney(body.salePrice);
  const cost = parseMoney(body.cost);

  const name = String(body.name || '').trim();
  const description = String(body.description || name).trim();
  if (!name) {
    const err = new Error('Name is required');
    err.status = 400;
    throw err;
  }

  const existing = await prisma.product.findUnique({
    where: { itemCode: parentCode },
    include: { variants: true },
  });

  if (!existing) {
    if (!categoryId) {
      const err = new Error('Unknown or missing category for this audience');
      err.status = 400;
      throw err;
    }
    if (parentPrice == null || parentPrice <= 0) {
      const err = new Error('Price is required on the parent or at least one child');
      err.status = 400;
      throw err;
    }
    const audField = shopSortFieldFor(audience);
    const [maxAll, maxAudience] = await Promise.all([
      prisma.product.aggregate({ _max: { shopSortAll: true } }),
      prisma.product.aggregate({
        where: { audience },
        _max: { [audField]: true },
      }),
    ]);
    const product = await prisma.product.create({
      data: {
        itemCode: parentCode,
        name,
        description,
        price: parentPrice,
        cost: cost ?? null,
        type: type || typeFromCategory(category, 'boxers'),
        audience,
        status: 'active',
        categoryId,
        photos: uniquePhotos,
        colors,
        photoByColor,
        sizes,
        stock,
        isSaleActive: isSaleActive && salePrice != null,
        salePrice: isSaleActive ? salePrice : null,
        shopSortAll: (maxAll._max.shopSortAll ?? -1) + 1,
        shopSortMen: 0,
        shopSortWomen: 0,
        shopSortBoys: 0,
        shopSortGirls: 0,
        shopSortBaby: 0,
        [audField]: (maxAudience._max[audField] ?? -1) + 1,
        variants: { create: variantWrites(variantRows) },
      },
      include: {
        variants: true,
        sizeStocks: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            audience: true,
            parentId: true,
            parent: { select: { id: true, name: true, slug: true } },
          },
        },
        reviews: { where: { isVisible: true }, select: { rating: true, isVisible: true } },
      },
    });
    return { created: true, product };
  }

  // Update parent fields (only overwrite when the sheet provided a value)
  const parentData = {
    name,
    description,
    type: type || existing.type,
    audience,
    categoryId: categoryId ?? existing.categoryId,
    colors,
    sizes,
    photoByColor,
    stock,
    sizeStocks: { deleteMany: {} },
  };
  if (parentPrice != null && parentPrice > 0) parentData.price = parentPrice;
  if (cost !== undefined) parentData.cost = cost;
  if (uniquePhotos.length) parentData.photos = uniquePhotos;
  if (body.isSaleActive !== undefined || body.salePrice !== undefined) {
    parentData.isSaleActive = isSaleActive && salePrice != null;
    parentData.salePrice = parentData.isSaleActive ? salePrice : null;
  }

  await prisma.product.update({ where: { id: existing.id }, data: parentData });

  for (let i = 0; i < variantRows.length; i += 1) {
    const row = variantRows[i];
    const found = await prisma.productVariant.findUnique({
      where: { itemCode: row.itemCode },
    });
    if (found && found.productId !== existing.id) {
      const err = new Error(
        `Child Item ID ${row.itemCode} already belongs to another product`
      );
      err.status = 400;
      throw err;
    }
    const data = {
      color: row.color,
      size: row.size,
      stock: row.stock,
      price: row.price,
      cost: row.cost,
      sortOrder: i,
      ...(row.photos?.length ? { photos: row.photos } : {}),
    };
    if (found) {
      await prisma.productVariant.update({ where: { id: found.id }, data });
    } else {
      await prisma.productVariant.create({
        data: {
          productId: existing.id,
          itemCode: row.itemCode,
          ...data,
          photos: row.photos || [],
        },
      });
    }
  }

  // Refresh aggregated stock from all children (including ones not in this sheet)
  const allVariants = await prisma.productVariant.findMany({
    where: { productId: existing.id },
  });
  const uniformAll = uniformChildPrice(allVariants);
  await prisma.product.update({
    where: { id: existing.id },
    data: {
      stock: allVariants.reduce((n, v) => n + v.stock, 0),
      colors: colorsFromVariants(allVariants),
      sizes: sizesFromVariants(allVariants),
      photoByColor: photoByColorFromVariants(allVariants) || photoByColor,
      ...(uniformAll != null ? { price: uniformAll } : {}),
    },
  });

  const product = await prisma.product.findUnique({
    where: { id: existing.id },
    include: {
      variants: { orderBy: { sortOrder: 'asc' } },
      sizeStocks: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          audience: true,
          parentId: true,
          parent: { select: { id: true, name: true, slug: true } },
        },
      },
      reviews: { where: { isVisible: true }, select: { rating: true, isVisible: true } },
    },
  });

  return { created: false, product };
};

/** Lightweight row returned from bulk patches (staff list refetches full products). */
const PATCH_RESULT_SELECT = {
  id: true,
  itemCode: true,
  name: true,
  price: true,
  cost: true,
};

/** When every child shares one price, write that onto the parent. */
const syncParentPriceFromChildren = async (productId) => {
  const variants = await prisma.productVariant.findMany({
    where: { productId },
    select: { price: true },
  });
  const uniform = uniformChildPrice(variants);
  if (uniform == null) return null;
  await prisma.product.update({
    where: { id: productId },
    data: { price: uniform },
  });
  return uniform;
};

/** Push a parent price onto every child variant. */
const applyParentPriceToChildren = async (productId, price) => {
  const n = parseMoney(price);
  if (n == null || n <= 0) return 0;
  const result = await prisma.productVariant.updateMany({
    where: { productId },
    data: { price: n },
  });
  return result.count;
};

/**
 * Update an existing parent Product or child ProductVariant by Item ID.
 * Only fields present on `body` are written (partial CLR rows / price lists).
 */
const patchByItemCode = async (body = {}) => {
  const code = cleanItemCode(body.itemCode ?? body.item_id);
  if (!code) {
    const err = new Error('Item ID is required');
    err.status = 400;
    throw err;
  }

  const has = (key) => Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined;

  // Prefer parent match first (price lists are usually parent Item IDs).
  const [existing, variant] = await Promise.all([
    prisma.product.findUnique({
      where: { itemCode: code },
      select: { id: true, _count: { select: { variants: true } } },
    }),
    prisma.productVariant.findUnique({
      where: { itemCode: code },
      select: { id: true, productId: true },
    }),
  ]);

  if (existing) {
    const data = {};
    if (has('name')) {
      const name = String(body.name || '').trim();
      if (name) data.name = name;
    }
    if (has('description')) {
      const description = String(body.description || '').trim();
      if (description) data.description = description;
    }
    if (has('price')) {
      const price = parseMoney(body.price);
      if (price != null && price > 0) data.price = price;
    }
    if (has('cost')) data.cost = parseMoney(body.cost);
    if ((has('stock') || has('stocks')) && !existing._count.variants) {
      data.stock = Math.max(0, Math.floor(Number(body.stock ?? body.stocks) || 0));
    }
    if (has('isSaleActive') || has('salePrice')) {
      const isSaleActive = Boolean(body.isSaleActive);
      const salePrice = parseMoney(body.salePrice);
      data.isSaleActive = isSaleActive && salePrice != null;
      data.salePrice = data.isSaleActive ? salePrice : null;
    }
    if (has('photos') || has('driveFolder') || has('drive_folder')) {
      const photos = await softResolvePhotos([
        ...(Array.isArray(body.photos) ? body.photos : []),
        body.driveFolder || body.drive_folder || '',
      ]);
      if (photos.length) data.photos = photos;
    }

    if (!Object.keys(data).length) {
      const err = new Error(`No updatable fields for ${code}`);
      err.status = 400;
      throw err;
    }

    await prisma.product.update({
      where: { id: existing.id },
      data,
    });
    if (existing._count.variants) {
      if (data.price != null && data.price > 0) {
        // Parent price change wins — push to every child.
        await applyParentPriceToChildren(existing.id, data.price);
      } else {
        await syncParentPriceFromChildren(existing.id);
      }
    }
    const product = await prisma.product.findUnique({
      where: { id: existing.id },
      select: PATCH_RESULT_SELECT,
    });
    return { created: false, patched: true, kind: 'product', product };
  }

  if (variant) {
    const data = {};
    if (has('price')) data.price = parseMoney(body.price);
    if (has('cost')) data.cost = parseMoney(body.cost);
    if (has('stock') || has('stocks')) {
      data.stock = Math.max(0, Math.floor(Number(body.stock ?? body.stocks) || 0));
    }
    if (has('color') || has('colors')) {
      const color = String(body.color ?? body.colors ?? '').trim();
      if (color && color.toLowerCase() !== 'parent') data.color = color;
    }
    if (has('size') || has('sizes')) {
      const size = String(body.size ?? body.sizes ?? '').trim();
      if (size && size.toLowerCase() !== 'parent') data.size = size;
    }
    if (has('photos') || has('driveFolder') || has('drive_folder')) {
      const photos = await softResolvePhotos([
        ...(Array.isArray(body.photos) ? body.photos : []),
        body.driveFolder || body.drive_folder || '',
      ]);
      if (photos.length) data.photos = photos;
    }
    if (!Object.keys(data).length) {
      const err = new Error(`No updatable fields for ${code}`);
      err.status = 400;
      throw err;
    }
    await prisma.productVariant.update({ where: { id: variant.id }, data });

    if (data.stock != null) {
      const all = await prisma.productVariant.findMany({
        where: { productId: variant.productId },
        select: { stock: true, price: true },
      });
      const parentData = {
        stock: all.reduce((n, v) => n + v.stock, 0),
      };
      const uniform = uniformChildPrice(all);
      if (uniform != null) parentData.price = uniform;
      await prisma.product.update({
        where: { id: variant.productId },
        data: parentData,
      });
    } else if (has('price')) {
      await syncParentPriceFromChildren(variant.productId);
    }

    const product = await prisma.product.findUnique({
      where: { id: variant.productId },
      select: PATCH_RESULT_SELECT,
    });
    return { created: false, patched: true, kind: 'variant', product };
  }

  const err = new Error(
    `Item ID ${code} not found — add name, category, colors, and sizes to create it, or set Parent SKU for a child`
  );
  err.status = 404;
  throw err;
};

module.exports = {
  upsertParentWithVariants,
  patchByItemCode,
  syncParentPriceFromChildren,
  applyParentPriceToChildren,
  softResolvePhotos,
  prepareVariantRows,
};
