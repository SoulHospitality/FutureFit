const prisma = require('../lib/prisma');
const cache = require('../lib/cache');
const { resolvePhotoLinks } = require('../utils/drivePhotos');
const {
  normalizeSizeStocks,
  sizeStockWrites,
} = require('../utils/sizeStock');
const { typeFromCategory, ratingSummary, AUDIENCES } = require('../utils/catalog');
const { listProductReviews, createProductReview } = require('./reviewController');

const serializeProduct = (p, { includeReviews = false } = {}) => {
  const variants = Array.isArray(p.sizeStocks)
    ? [...p.sizeStocks].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    : [];
  const sizeStocks = variants.map((v) => ({ size: v.size, stock: v.stock }));
  const sizes = p.sizes?.length ? p.sizes : sizeStocks.map((s) => s.size);
  const stock = sizeStocks.length
    ? sizeStocks.reduce((n, s) => n + s.stock, 0)
    : p.stock;
  const { ratingAvg, reviewCount } = ratingSummary(p.reviews || []);
  const category = p.category
    ? {
        id: p.category.id,
        name: p.category.name,
        slug: p.category.slug,
        audience: p.category.audience,
      }
    : null;
  const out = {
    ...p,
    price: Number(p.price),
    salePrice: p.salePrice != null ? Number(p.salePrice) : null,
    sizes,
    sizeStocks,
    stock,
    audience: p.audience || 'men',
    category,
    ratingAvg,
    reviewCount,
  };
  delete out.reviews;
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
  name: true,
  description: true,
  price: true,
  type: true,
  audience: true,
  categoryId: true,
  photos: true,
  colors: true,
  sizes: true,
  stock: true,
  isSaleActive: true,
  salePrice: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: { id: true, name: true, slug: true, audience: true },
  },
  sizeStocks: {
    select: { size: true, stock: true, sortOrder: true },
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
  }
  const type = body.type || typeFromCategory(category, 'boxers');
  return { audience, categoryId: category?.id || null, type };
};

const listProducts = async (req, res) => {
  try {
    const { type, q, limit, audience, category } = req.query;
    const take = Math.min(Number(limit) || 100, 100);
    const useCache = !req.headers.authorization;
    const cacheKey = `products:${type || ''}:${audience || ''}:${category || ''}:${q || ''}:${take}`;

    const load = async () => {
      const where = {};
      if (type) where.type = type;
      if (audience && AUDIENCES.includes(audience)) where.audience = audience;
      if (category) {
        where.category = { slug: category, ...(where.audience ? { audience: where.audience } : {}) };
      }
      if (q) {
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ];
      }
      const rows = await prisma.product.findMany({
        where,
        select: PRODUCT_SELECT,
        orderBy: { createdAt: 'desc' },
        take,
      });
      return rows.map((row) => serializeProduct(row));
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
    const { data: product } = await cache.wrap(
      `product:${req.params.id}`,
      ITEM_TTL_MS,
      async () => {
        const row = await prisma.product.findUnique({
          where: { id: req.params.id },
          select: PRODUCT_DETAIL_SELECT,
        });
        return row ? serializeProduct(row, { includeReviews: true }) : null;
      }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.set('Cache-Control', 'public, max-age=20, stale-while-revalidate=40');
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

const createProduct = async (req, res) => {
  try {
    const { name, description, price, photos, colors, isSaleActive, salePrice } = req.body;
    if (!name || !description || price == null) {
      return res.status(400).json({ message: 'Name, description, and price are required' });
    }

    const sizeRows = normalizeSizeStocks(req.body);
    if (!sizeRows.length) {
      return res.status(400).json({ message: 'Add at least one size with stock' });
    }

    const { audience, categoryId, type } = await resolveAudienceAndCategory(req.body);
    const resolvedPhotos = await resolvePhotoLinks(photos || []);

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price,
        type,
        audience,
        categoryId,
        photos: resolvedPhotos,
        colors: colors || [],
        sizes: sizeRows.map((r) => r.size),
        stock: sizeRows.reduce((n, r) => n + r.stock, 0),
        isSaleActive: Boolean(isSaleActive),
        salePrice: salePrice || null,
        sizeStocks: { create: sizeStockWrites(sizeRows) },
      },
      select: PRODUCT_SELECT,
    });
    bustProductCache();
    res.status(201).json(serializeProduct(product));
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    res.status(500).json({ message: error.message });
  }
};

const ALLOWED_UPDATE = [
  'name',
  'description',
  'price',
  'type',
  'photos',
  'colors',
  'isSaleActive',
  'salePrice',
];

const updateProduct = async (req, res) => {
  try {
    const data = {};
    for (const key of ALLOWED_UPDATE) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    if (data.photos) {
      data.photos = await resolvePhotoLinks(data.photos);
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
    if (
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
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
      select: PRODUCT_SELECT,
    });
    bustProductCache();
    res.json(serializeProduct(product));
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    res.status(500).json({ message: error.message });
  }
};

const adjustStock = async (req, res) => {
  try {
    const delta = Number(req.body.delta);
    const size = req.body.size != null ? String(req.body.size).trim() : '';
    if (!Number.isFinite(delta)) {
      return res.status(400).json({ message: 'delta must be a number' });
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
  updateProduct,
  adjustStock,
  deleteProduct,
  listProductReviews,
  createProductReview,
};
