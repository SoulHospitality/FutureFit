const prisma = require('../lib/prisma');
const cache = require('../lib/cache');

const COLLECTIONS = {
  all: { field: 'shopSortAll', audience: null, label: 'All' },
  men: { field: 'shopSortMen', audience: 'men', label: 'Men' },
  women: { field: 'shopSortWomen', audience: 'women', label: 'Women' },
  kids: { field: 'shopSortKids', audience: 'kids', label: 'Kids' },
};

const serializeLite = (p) => ({
  id: p.id,
  name: p.name,
  photos: p.photos || [],
  price: Number(p.price),
  salePrice: p.salePrice != null ? Number(p.salePrice) : null,
  isSaleActive: Boolean(p.isSaleActive),
  audience: p.audience,
  status: p.status,
  type: p.type,
  shopSortAll: p.shopSortAll ?? 0,
  shopSortMen: p.shopSortMen ?? 0,
  shopSortWomen: p.shopSortWomen ?? 0,
  shopSortKids: p.shopSortKids ?? 0,
});

const getShopOrder = async (req, res) => {
  try {
    const key = String(req.query.collection || 'all').toLowerCase();
    const meta = COLLECTIONS[key];
    if (!meta) {
      return res.status(400).json({ message: 'Invalid collection' });
    }

    const where = {};
    if (meta.audience) where.audience = meta.audience;

    const rows = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        photos: true,
        price: true,
        salePrice: true,
        isSaleActive: true,
        audience: true,
        status: true,
        type: true,
        shopSortAll: true,
        shopSortMen: true,
        shopSortWomen: true,
        shopSortKids: true,
        createdAt: true,
      },
      orderBy: [{ [meta.field]: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({
      collection: key,
      label: meta.label,
      products: rows.map(serializeLite),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const saveShopOrder = async (req, res) => {
  try {
    const key = String(req.body.collection || '').toLowerCase();
    const meta = COLLECTIONS[key];
    if (!meta) {
      return res.status(400).json({ message: 'Invalid collection' });
    }

    const productIds = Array.isArray(req.body.productIds)
      ? req.body.productIds.map(String).filter(Boolean)
      : [];
    if (!productIds.length) {
      return res.status(400).json({ message: 'productIds required' });
    }

    await prisma.$transaction(
      productIds.map((id, index) =>
        prisma.product.update({
          where: { id },
          data: { [meta.field]: index },
        })
      )
    );

    cache.invalidate('products');
    cache.invalidate('product');

    res.json({ ok: true, collection: key, count: productIds.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  COLLECTIONS,
  getShopOrder,
  saveShopOrder,
};
