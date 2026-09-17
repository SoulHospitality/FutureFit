const prisma = require('../lib/prisma');
const cache = require('../lib/cache');

const SECTIONS = ['best_sellers', 'packs'];

const PRODUCT_SELECT = {
  id: true,
  name: true,
  description: true,
  price: true,
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
  createdAt: true,
  updatedAt: true,
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
  sizeStocks: {
    select: { size: true, stock: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
};

const serializeProduct = (p) => {
  const variants = Array.isArray(p.sizeStocks)
    ? [...p.sizeStocks].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    : [];
  const sizeStocks = variants.map((v) => ({ size: v.size, stock: v.stock }));
  const sizes = p.sizes?.length ? p.sizes : sizeStocks.map((s) => s.size);
  const stock = sizeStocks.length
    ? sizeStocks.reduce((n, s) => n + s.stock, 0)
    : p.stock;
  return {
    ...p,
    price: Number(p.price),
    salePrice: p.salePrice != null ? Number(p.salePrice) : null,
    sizes,
    sizeStocks,
    stock,
    audience: p.audience || 'men',
    status: p.status === 'draft' ? 'draft' : 'active',
  };
};

const loadSectionProducts = async (section, { activeOnly = true } = {}) => {
  const rows = await prisma.homepageProduct.findMany({
    where: {
      section,
      ...(activeOnly ? { product: { status: 'active' } } : {}),
    },
    orderBy: { sortOrder: 'asc' },
    include: {
      product: { select: PRODUCT_SELECT },
    },
  });
  return rows
    .filter((r) => r.product)
    .map((r) => ({
      ...serializeProduct(r.product),
      homepageSortOrder: r.sortOrder,
    }));
};

const getHomepage = async (_req, res) => {
  try {
    const { data } = await cache.wrap('homepage:sections', 30_000, async () => {
      const [bestSellers, packs] = await Promise.all([
        loadSectionProducts('best_sellers', { activeOnly: true }),
        loadSectionProducts('packs', { activeOnly: true }),
      ]);
      return { bestSellers, packs };
    });
    res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getHomepageAdmin = async (_req, res) => {
  try {
    const [bestSellers, packs] = await Promise.all([
      loadSectionProducts('best_sellers', { activeOnly: false }),
      loadSectionProducts('packs', { activeOnly: false }),
    ]);
    res.json({ bestSellers, packs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const normalizeIds = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
};

const putHomepage = async (req, res) => {
  try {
    const bestSellerIds = normalizeIds(req.body.bestSellers);
    const packIds = normalizeIds(req.body.packs);
    const allIds = [...new Set([...bestSellerIds, ...packIds])];

    if (allIds.length) {
      const found = await prisma.product.findMany({
        where: { id: { in: allIds } },
        select: { id: true },
      });
      const ok = new Set(found.map((p) => p.id));
      const missing = allIds.filter((id) => !ok.has(id));
      if (missing.length) {
        return res.status(400).json({ message: `Unknown product id: ${missing[0]}` });
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const section of SECTIONS) {
        const ids = section === 'best_sellers' ? bestSellerIds : packIds;
        await tx.homepageProduct.deleteMany({ where: { section } });
        if (!ids.length) continue;
        await tx.homepageProduct.createMany({
          data: ids.map((productId, sortOrder) => ({
            section,
            productId,
            sortOrder,
          })),
        });
      }
    });

    cache.invalidate('homepage');
    cache.invalidate('products');

    const [bestSellers, packs] = await Promise.all([
      loadSectionProducts('best_sellers', { activeOnly: false }),
      loadSectionProducts('packs', { activeOnly: false }),
    ]);
    res.json({ bestSellers, packs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getHomepage,
  getHomepageAdmin,
  putHomepage,
};
