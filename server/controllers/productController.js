const prisma = require('../lib/prisma');
const cache = require('../lib/cache');
const { resolvePhotoLinks } = require('../utils/drivePhotos');
const {
  normalizeSizeStocks,
  sizeStockWrites,
} = require('../utils/sizeStock');
const {
  normalizeVariants,
  variantWrites,
  colorsFromVariants,
  sizesFromVariants,
  photoByColorFromVariants,
  totalVariantStock,
} = require('../utils/variants');
const { typeFromCategory, ratingSummary, AUDIENCES } = require('../utils/catalog');
const { nextItemCode, cleanItemCode } = require('../utils/itemCode');
const { upsertParentWithVariants } = require('../utils/bulkCatalog');
const { listProductReviews, createProductReview } = require('./reviewController');

const serializeProduct = (p, { includeReviews = false, staff = false } = {}) => {
  const childVariants = Array.isArray(p.variants)
    ? [...p.variants].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    : [];
  const legacySizes = Array.isArray(p.sizeStocks)
    ? [...p.sizeStocks].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    : [];
  const variants = childVariants.map((v) => ({
    id: v.id,
    color: v.color,
    size: v.size,
    stock: v.stock,
    price: v.price != null ? Number(v.price) : null,
    photos: v.photos || [],
    ...(staff
      ? {
          itemCode: v.itemCode,
          cost: v.cost != null ? Number(v.cost) : null,
        }
      : {}),
  }));
  const colors = childVariants.length
    ? colorsFromVariants(childVariants)
    : p.colors || [];
  const sizes = childVariants.length
    ? sizesFromVariants(childVariants)
    : p.sizes?.length
      ? p.sizes
      : legacySizes.map((s) => s.size);
  const sizeStocks = childVariants.length
    ? sizes.map((size) => ({
        size,
        stock: childVariants
          .filter((v) => String(v.size).toLowerCase() === String(size).toLowerCase())
          .reduce((n, v) => n + (Number(v.stock) || 0), 0),
      }))
    : legacySizes.map((v) => ({ size: v.size, stock: v.stock }));
  const stock = childVariants.length
    ? totalVariantStock({ variants: childVariants })
    : sizeStocks.length
      ? sizeStocks.reduce((n, s) => n + s.stock, 0)
      : p.stock;
  const photoByColor =
    photoByColorFromVariants(childVariants) || p.photoByColor || null;
  const parentPhotos =
    (p.photos || []).length
      ? p.photos
      : variants.flatMap((v) => v.photos || []).filter(Boolean).slice(0, 12);
  const { ratingAvg, reviewCount } = ratingSummary(p.reviews || []);
  const category = p.category
    ? {
        id: p.category.id,
        name: p.category.name,
        slug: p.category.slug,
        audience: p.category.audience,
        parentId: p.category.parentId || null,
        parent: p.category.parent
          ? {
              id: p.category.parent.id,
              name: p.category.parent.name,
              slug: p.category.parent.slug,
            }
          : null,
      }
    : null;
  const out = {
    ...p,
    price: Number(p.price),
    salePrice: p.salePrice != null ? Number(p.salePrice) : null,
    cost: p.cost != null ? Number(p.cost) : null,
    colors,
    sizes,
    sizeStocks,
    variants,
    photoByColor,
    photos: parentPhotos,
    stock,
    audience: p.audience || 'men',
    status: p.status === 'draft' ? 'draft' : 'active',
    category,
    ratingAvg,
    reviewCount,
  };
  delete out.reviews;
  if (!staff) {
    delete out.itemCode;
    delete out.cost;
  }
  if (includeReviews) {
    out.reviews = (p.reviews || [])
      .filter((r) => r.isVisible !== false)
      .map((r) => ({
        id: r.id,
        name: r.name,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
      }));
  }
  return out;
};

const PRODUCT_SELECT = {
  id: true,
  itemCode: true,
  name: true,
  description: true,
  price: true,
  cost: true,
  type: true,
  audience: true,
  status: true,
  categoryId: true,
  photos: true,
  colors: true,
  photoByColor: true,
  sizes: true,
  stock: true,
  isSaleActive: true,
  salePrice: true,
  saleQtyLimit: true,
  saleQtySold: true,
  shopSortAll: true,
  shopSortMen: true,
  shopSortWomen: true,
  shopSortBoys: true,
  shopSortGirls: true,
  shopSortBaby: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      audience: true,
      parentId: true,
      sizeChartUrl: true,
      parent: { select: { id: true, name: true, slug: true, sizeChartUrl: true } },
    },
  },
  sizeStocks: {
    select: { size: true, stock: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  variants: {
    select: {
      id: true,
      itemCode: true,
      color: true,
      size: true,
      stock: true,
      price: true,
      cost: true,
      photos: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: 'asc' },
  },
  reviews: {
    where: { isVisible: true },
    select: { rating: true, isVisible: true },
  },
};

const PRODUCT_DETAIL_SELECT = {
  ...PRODUCT_SELECT,
  reviews: {
    where: { isVisible: true },
    select: {
      id: true,
      name: true,
      rating: true,
      comment: true,
      isVisible: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  },
};

const LIST_TTL_MS = 20_000;
const ITEM_TTL_MS = 30_000;

const bustProductCache = () => {
  cache.invalidate('products');
  cache.invalidate('product');
};

const applySizeStocks = (rows) => ({
  sizes: rows.map((r) => r.size),
  stock: rows.reduce((n, r) => n + r.stock, 0),
  sizeStocks: {
    deleteMany: {},
    create: sizeStockWrites(rows),
  },
});

const applyVariants = (rows) => ({
  colors: colorsFromVariants(rows),
  sizes: sizesFromVariants(rows),
  stock: rows.reduce((n, r) => n + r.stock, 0),
  photoByColor: photoByColorFromVariants(rows),
  variants: {
    deleteMany: {},
    create: variantWrites(rows),
  },
  // Clear legacy size rows when real color/size children exist
  sizeStocks: { deleteMany: {} },
});

const resolveAudienceAndCategory = async (body) => {
  const audience = AUDIENCES.includes(body.audience) ? body.audience : 'men';
  let category = null;
  if (body.categoryId) {
    category = await prisma.category.findUnique({ where: { id: body.categoryId } });
    if (!category) {
      const err = new Error('Subcategory not found');
      err.status = 400;
      throw err;
    }
  } else if (body.category || body.categorySlug) {
    const slug = String(body.categorySlug || body.category)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (slug) {
      category = await prisma.category.findFirst({
        where: { slug, audience },
      });
    }
  }
  const type = body.type || typeFromCategory(category, 'boxers');
  return { audience, categoryId: category?.id || null, type };
};

const normalizePhotoByColor = (raw, colors = []) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  const colorSet = new Set((colors || []).map((c) => String(c).trim()).filter(Boolean));
  for (const [key, value] of Object.entries(raw)) {
    const color = String(key || '').trim();
    if (!color) continue;
    if (colorSet.size && !colorSet.has(color)) continue;
    const urls = (Array.isArray(value) ? value : [value])
      .map((u) => String(u || '').trim())
      .filter(Boolean);
    if (urls.length) out[color] = urls.length === 1 ? urls[0] : urls;
  }
  return Object.keys(out).length ? out : null;
};

/** undefined = not sent, null = no cap, otherwise a positive unit count. */
const parseCost = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error('Cost must be zero or more');
    err.status = 400;
    throw err;
  }
  return n;
};

const parseSaleQtyLimit = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const buildProductCreateData = async (body) => {
  const { name, description, price, photos, colors, isSaleActive, salePrice } = body;
  if (!name || !description || price == null) {
    const err = new Error('Name, description, and price are required');
    err.status = 400;
    throw err;
  }

  const variantRows = normalizeVariants(body);
  const sizeRows = variantRows.length ? [] : normalizeSizeStocks(body);
  if (!variantRows.length && !sizeRows.length) {
    const err = new Error('Add at least one color/size variant with stock');
    err.status = 400;
    throw err;
  }

  const { audience, categoryId, type } = await resolveAudienceAndCategory(body);
  const photoLinks = [...(photos || [])];
  if (body.driveFolder?.trim()) {
    photoLinks.push(body.driveFolder.trim());
  }
  const resolvedPhotos = await resolvePhotoLinks(photoLinks);
  // Resolve per-variant Drive folders / photo links when provided
  for (const row of variantRows) {
    if (row.photos?.length) {
      row.photos = await resolvePhotoLinks(row.photos);
    }
  }
  const colorList = variantRows.length
    ? colorsFromVariants(variantRows)
    : colors || [];
  const photoByColor =
    photoByColorFromVariants(variantRows) ||
    normalizePhotoByColor(body.photoByColor, colorList);
  const status =
    String(body.status || 'active').toLowerCase() === 'draft' ? 'draft' : 'active';

  const AUDIENCE_SORT = {
    men: 'shopSortMen',
    women: 'shopSortWomen',
    boys: 'shopSortBoys',
    girls: 'shopSortGirls',
    baby: 'shopSortBaby',
  };
  const audienceField = AUDIENCE_SORT[audience] || 'shopSortMen';
  const [maxAll, maxAudience] = await Promise.all([
    prisma.product.aggregate({ _max: { shopSortAll: true } }),
    prisma.product.aggregate({
      where: { audience },
      _max: {
        shopSortMen: true,
        shopSortWomen: true,
        shopSortBoys: true,
        shopSortGirls: true,
        shopSortBaby: true,
      },
    }),
  ]);
  const nextAll = (maxAll._max.shopSortAll ?? -1) + 1;
  const nextAudience = (maxAudience._max[audienceField] ?? -1) + 1;

  const stockRows = variantRows.length ? variantRows : sizeRows;
  return {
    name: String(name).trim(),
    description: String(description).trim(),
    price,
    cost: parseCost(body.cost) ?? null,
    type,
    audience,
    status,
    categoryId,
    photos: resolvedPhotos,
    colors: colorList,
    photoByColor,
    sizes: variantRows.length
      ? sizesFromVariants(variantRows)
      : sizeRows.map((r) => r.size),
    stock: stockRows.reduce((n, r) => n + r.stock, 0),
    isSaleActive: Boolean(isSaleActive),
    salePrice: salePrice || null,
    saleQtyLimit: parseSaleQtyLimit(body.saleQtyLimit) ?? null,
    shopSortAll: nextAll,
    shopSortMen: audience === 'men' ? nextAudience : 0,
    shopSortWomen: audience === 'women' ? nextAudience : 0,
    shopSortBoys: audience === 'boys' ? nextAudience : 0,
    shopSortGirls: audience === 'girls' ? nextAudience : 0,
    shopSortBaby: audience === 'baby' ? nextAudience : 0,
    ...(variantRows.length
      ? { variants: { create: variantWrites(variantRows) } }
      : { sizeStocks: { create: sizeStockWrites(sizeRows) } }),
  };
};

const listProducts = async (req, res) => {
  try {
    const { type, q, limit, audience, category, status } = req.query;
    const take = Math.min(Number(limit) || 500, 2000);
    const isStaff = req.user?.role === 'admin';
    const useCache = !isStaff;
    const statusKey = isStaff ? String(status || 'all') : 'active';
    const cacheKey = `products:${type || ''}:${audience || ''}:${category || ''}:${q || ''}:${statusKey}:${take}`;

    const load = async () => {
      const where = {};
      if (!isStaff) {
        where.status = 'active';
      } else if (status === 'active' || status === 'draft') {
        where.status = status;
      }
      if (type) where.type = type;
      if (audience && AUDIENCES.includes(audience)) where.audience = audience;
      if (category) {
        const matched = await prisma.category.findMany({
          where: {
            slug: String(category),
            ...(where.audience ? { audience: where.audience } : {}),
          },
          select: { id: true, children: { select: { id: true } } },
        });
        if (matched.length) {
          const ids = matched.flatMap((c) => [c.id, ...c.children.map((ch) => ch.id)]);
          where.categoryId = { in: [...new Set(ids)] };
        } else {
          where.category = {
            slug: String(category),
            ...(where.audience ? { audience: where.audience } : {}),
          };
        }
      }
      if (q) {
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ];
      }
      const sortField =
        {
          men: 'shopSortMen',
          women: 'shopSortWomen',
          boys: 'shopSortBoys',
          girls: 'shopSortGirls',
          baby: 'shopSortBaby',
        }[audience] || 'shopSortAll';
      const rows = await prisma.product.findMany({
        where,
        select: PRODUCT_SELECT,
        orderBy: [{ [sortField]: 'asc' }, { createdAt: 'desc' }],
        take,
      });
      return rows.map((row) => serializeProduct(row, { staff: isStaff }));
    };

    const products = useCache
      ? (await cache.wrap(cacheKey, LIST_TTL_MS, load)).data
      : await load();

    res.set(
      'Cache-Control',
      useCache
        ? 'public, max-age=15, stale-while-revalidate=30'
        : 'no-store'
    );
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProduct = async (req, res) => {
  try {
    const isStaff = req.user?.role === 'admin';
    const { data: product } = await cache.wrap(
      `product:${req.params.id}:${isStaff ? 'staff' : 'public'}`,
      ITEM_TTL_MS,
      async () => {
        const row = await prisma.product.findUnique({
          where: { id: req.params.id },
          select: PRODUCT_DETAIL_SELECT,
        });
        if (!row) return null;
        if (!isStaff && row.status !== 'active') return null;
        return serializeProduct(row, { includeReviews: true, staff: isStaff });
      }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.set(
      'Cache-Control',
      isStaff
        ? 'no-store'
        : 'public, max-age=20, stale-while-revalidate=40'
    );
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const resolvePhotos = async (req, res) => {
  try {
    const links = req.body.links || req.body.photos || [];
    const photos = await resolvePhotoLinks(links);
    res.json({ photos, count: photos.length });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const duplicateItemCode = () => {
  const err = new Error('That item ID is already used');
  err.status = 400;
  return err;
};

const insertProduct = async (data) => {
  const requested = data.itemCode || null;
  const rest = { ...data };
  delete rest.itemCode;
  const attempts = requested ? 1 : 5;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await prisma.product.create({
        data: { ...rest, itemCode: requested || (await nextItemCode()) },
        select: PRODUCT_SELECT,
      });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
      if (requested || attempt === attempts - 1) throw duplicateItemCode();
    }
  }
  return null;
};

const createProduct = async (req, res) => {
  try {
    const data = await buildProductCreateData(req.body);
    data.itemCode = cleanItemCode(req.body.itemCode);
    const product = await insertProduct(data);
    bustProductCache();
    res.status(201).json(serializeProduct(product, { staff: true }));
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    res.status(500).json({ message: error.message });
  }
};

const bulkCreateProducts = async (req, res) => {
  try {
    const items = req.body.products;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: 'products array is required' });
    }
    if (items.length > 200) {
      return res.status(400).json({ message: 'Maximum 200 parent products per upload' });
    }

    const created = [];
    const updated = [];
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      try {
        // New CLR format: parent + nested children. Legacy flat rows still create.
        if (Array.isArray(row.variants) && row.variants.length) {
          const result = await upsertParentWithVariants(row, {
            resolveAudienceAndCategory,
          });
          const serialized = serializeProduct(result.product, { staff: true });
          if (result.created) created.push(serialized);
          else updated.push(serialized);
        } else {
          const data = await buildProductCreateData(row);
          data.itemCode = cleanItemCode(row.itemCode ?? row.item_id);
          const existing = data.itemCode
            ? await prisma.product.findUnique({ where: { itemCode: data.itemCode } })
            : null;
          if (existing) {
            const { sizeStocks, variants, shopSortAll, shopSortMen, shopSortWomen, shopSortKids, ...rest } =
              data;
            const product = await prisma.product.update({
              where: { id: existing.id },
              data: {
                ...rest,
                ...(variants || sizeStocks
                  ? variants
                    ? {
                        variants: {
                          deleteMany: {},
                          create: variants.create,
                        },
                        sizeStocks: { deleteMany: {} },
                      }
                    : {
                        sizeStocks: {
                          deleteMany: {},
                          create: sizeStocks.create,
                        },
                      }
                  : {}),
              },
              select: PRODUCT_SELECT,
            });
            updated.push(serializeProduct(product, { staff: true }));
          } else {
            const product = await insertProduct(data);
            created.push(serializeProduct(product, { staff: true }));
          }
        }
      } catch (err) {
        errors.push({
          row: i + 1,
          name: row?.name || row?.itemCode || '',
          message: err.message || 'Could not import product',
        });
      }
    }

    if (created.length || updated.length) bustProductCache();
    const ok = created.length + updated.length;
    res.status(ok ? 201 : 400).json({
      created: created.length,
      updated: updated.length,
      failed: errors.length,
      products: [...created, ...updated],
      errors,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const ALLOWED_UPDATE = [
  'name',
  'description',
  'price',
  'type',
  'status',
  'photos',
  'colors',
  'photoByColor',
  'isSaleActive',
  'salePrice',
];

const updateProduct = async (req, res) => {
  try {
    const data = {};
    for (const key of ALLOWED_UPDATE) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    if (data.status != null) {
      data.status = String(data.status).toLowerCase() === 'draft' ? 'draft' : 'active';
    }
    if (req.body.cost !== undefined) data.cost = parseCost(req.body.cost);
    if (req.body.itemCode !== undefined) {
      const code = cleanItemCode(req.body.itemCode);
      if (!code) {
        return res.status(400).json({ message: 'Item ID is required' });
      }
      const taken = await prisma.product.findUnique({
        where: { itemCode: code },
        select: { id: true },
      });
      if (taken && taken.id !== req.params.id) throw duplicateItemCode();
      data.itemCode = code;
    }
    const saleQtyLimit = parseSaleQtyLimit(req.body.saleQtyLimit);
    if (saleQtyLimit !== undefined) data.saleQtyLimit = saleQtyLimit;
    if (data.isSaleActive === true || req.body.resetSaleCount === true) {
      const current = await prisma.product.findUnique({
        where: { id: req.params.id },
        select: { isSaleActive: true },
      });
      // Switching a sale on starts a fresh count toward its stock cap
      if (!current?.isSaleActive || req.body.resetSaleCount === true) data.saleQtySold = 0;
    }
    if (data.photos) {
      data.photos = await resolvePhotoLinks(data.photos);
    }
    if (req.body.photoByColor !== undefined || req.body.colors !== undefined) {
      let colorList = data.colors;
      let map = req.body.photoByColor;
      if (colorList === undefined || map === undefined) {
        const existing = await prisma.product.findUnique({
          where: { id: req.params.id },
          select: { colors: true, photoByColor: true },
        });
        if (colorList === undefined) colorList = existing?.colors || [];
        if (map === undefined) map = existing?.photoByColor;
      }
      data.photoByColor = normalizePhotoByColor(map, colorList);
    } else {
      delete data.photoByColor;
    }
    if (
      req.body.audience !== undefined ||
      req.body.categoryId !== undefined
    ) {
      const resolved = await resolveAudienceAndCategory({
        audience: req.body.audience,
        categoryId: req.body.categoryId,
        type: req.body.type,
      });
      data.audience = resolved.audience;
      data.categoryId = resolved.categoryId;
      if (!req.body.type) data.type = resolved.type;
    }
    if (req.body.variants !== undefined) {
      const variantRows = normalizeVariants(req.body);
      if (!variantRows.length) {
        return res.status(400).json({ message: 'Add at least one color/size variant' });
      }
      for (const row of variantRows) {
        if (row.photos?.length) {
          row.photos = await resolvePhotoLinks(row.photos);
        }
      }
      Object.assign(data, applyVariants(variantRows));
    } else if (
      req.body.sizeStocks !== undefined ||
      req.body.sizes !== undefined ||
      req.body.stock !== undefined
    ) {
      const sizeRows = normalizeSizeStocks(req.body);
      if (!sizeRows.length) {
        return res.status(400).json({ message: 'Add at least one size with stock' });
      }
      Object.assign(data, applySizeStocks(sizeRows));
    }
    let product = await prisma.product.update({
      where: { id: req.params.id },
      data,
      select: PRODUCT_SELECT,
    });
    if (
      product.isSaleActive &&
      product.saleQtyLimit != null &&
      product.saleQtySold >= product.saleQtyLimit
    ) {
      product = await prisma.product.update({
        where: { id: req.params.id },
        data: { isSaleActive: false },
        select: PRODUCT_SELECT,
      });
    }
    bustProductCache();
    res.json(serializeProduct(product, { staff: true }));
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ message: 'That item ID is already used' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    res.status(500).json({ message: error.message });
  }
};

const adjustStock = async (req, res) => {
  try {
    const delta = Number(req.body.delta);
    const size = req.body.size != null ? String(req.body.size).trim() : '';
    const color = req.body.color != null ? String(req.body.color).trim() : '';
    if (!Number.isFinite(delta)) {
      return res.status(400).json({ message: 'delta must be a number' });
    }

    if (color && size) {
      const child = await prisma.productVariant.findFirst({
        where: {
          productId: req.params.id,
          color: { equals: color, mode: 'insensitive' },
          size: { equals: size, mode: 'insensitive' },
        },
      });
      if (!child) {
        return res.status(404).json({ message: `Variant ${color} / ${size} not found` });
      }
      const nextStock = Math.max(0, child.stock + delta);
      const applied = nextStock - child.stock;
      const [updatedVariant, product] = await prisma.$transaction([
        prisma.productVariant.update({
          where: { id: child.id },
          data: { stock: nextStock },
          select: { id: true, color: true, size: true, stock: true },
        }),
        prisma.product.update({
          where: { id: req.params.id },
          data: { stock: { increment: applied } },
          select: { id: true, stock: true },
        }),
      ]);
      bustProductCache();
      res.set('Cache-Control', 'no-store');
      return res.json({
        id: product.id,
        color: updatedVariant.color,
        size: updatedVariant.size,
        stock: updatedVariant.stock,
        totalStock: product.stock,
      });
    }

    if (size) {
      const variant = await prisma.productSize.findUnique({
        where: { productId_size: { productId: req.params.id, size } },
      });
      if (!variant) {
        return res.status(404).json({ message: `Size ${size} not found` });
      }
      const nextStock = Math.max(0, variant.stock + delta);
      const applied = nextStock - variant.stock;
      const [updatedVariant, product] = await prisma.$transaction([
        prisma.productSize.update({
          where: { id: variant.id },
          data: { stock: nextStock },
          select: { id: true, size: true, stock: true },
        }),
        prisma.product.update({
          where: { id: req.params.id },
          data: { stock: { increment: applied } },
          select: { id: true, stock: true },
        }),
      ]);
      bustProductCache();
      res.set('Cache-Control', 'no-store');
      return res.json({
        id: product.id,
        size: updatedVariant.size,
        stock: updatedVariant.stock,
        totalStock: product.stock,
      });
    }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: { stock: { increment: delta } },
      select: { id: true, stock: true },
    });

    if (updated.stock < 0) {
      const fixed = await prisma.product.update({
        where: { id: req.params.id },
        data: { stock: 0 },
        select: { id: true, stock: true },
      });
      bustProductCache();
      res.set('Cache-Control', 'no-store');
      return res.json(fixed);
    }

    bustProductCache();
    res.set('Cache-Control', 'no-store');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    bustProductCache();
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listProducts,
  getProduct,
  resolvePhotos,
  createProduct,
  bulkCreateProducts,
  updateProduct,
  adjustStock,
  deleteProduct,
  listProductReviews,
  createProductReview,
};
