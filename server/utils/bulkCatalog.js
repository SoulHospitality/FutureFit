const prisma = require('../lib/prisma');
const { resolvePhotoLinks } = require('./drivePhotos');
const { typeFromCategory } = require('./catalog');
const { cleanItemCode } = require('./itemCode');
const {
  normalizeVariants,
  variantWrites,
  colorsFromVariants,
  sizesFromVariants,
  photoByColorFromVariants,
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
  const parentPrice =
    bodyPrice != null && bodyPrice > 0
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
    const [maxAll, maxAudience] = await Promise.all([
      prisma.product.aggregate({ _max: { shopSortAll: true } }),
      prisma.product.aggregate({
        where: { audience },
        _max: { shopSortMen: true, shopSortWomen: true, shopSortKids: true },
      }),
    ]);
    const audField =
      audience === 'women'
        ? 'shopSortWomen'
        : audience === 'kids'
          ? 'shopSortKids'
          : 'shopSortMen';
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
        shopSortMen: audience === 'men' ? (maxAudience._max.shopSortMen ?? -1) + 1 : 0,
        shopSortWomen: audience === 'women' ? (maxAudience._max.shopSortWomen ?? -1) + 1 : 0,
        shopSortKids: audience === 'kids' ? (maxAudience._max.shopSortKids ?? -1) + 1 : 0,
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
  await prisma.product.update({
    where: { id: existing.id },
    data: {
      stock: allVariants.reduce((n, v) => n + v.stock, 0),
      colors: colorsFromVariants(allVariants),
      sizes: sizesFromVariants(allVariants),
      photoByColor: photoByColorFromVariants(allVariants) || photoByColor,
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

module.exports = {
  upsertParentWithVariants,
  softResolvePhotos,
  prepareVariantRows,
};
