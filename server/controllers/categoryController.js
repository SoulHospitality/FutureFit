const prisma = require('../lib/prisma');
const cache = require('../lib/cache');
const { slugify, serializeCategory, AUDIENCES } = require('../utils/catalog');

const bust = () => {
  cache.invalidate('categories');
  cache.invalidate('products');
  cache.invalidate('product');
};

const listCategories = async (req, res) => {
  try {
    const { audience } = req.query;
    const where = {};
    if (audience && AUDIENCES.includes(audience)) where.audience = audience;
    const rows = await prisma.category.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: [{ audience: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json(rows.map(serializeCategory));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createCategory = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const audience = String(req.body.audience || '').trim();
    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (!AUDIENCES.includes(audience)) {
      return res.status(400).json({ message: 'Audience must be men, women, or kids' });
    }
    const slug = slugify(req.body.slug || name);
    if (!slug) return res.status(400).json({ message: 'A valid slug is required' });

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        audience,
        sortOrder: Number(req.body.sortOrder) || 0,
      },
      include: { _count: { select: { products: true } } },
    });
    bust();
    res.status(201).json(serializeCategory(category));
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'That subcategory already exists for this department' });
    }
    res.status(500).json({ message: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const data = {};
    if (req.body.name !== undefined) data.name = String(req.body.name).trim();
    if (req.body.sortOrder !== undefined) data.sortOrder = Number(req.body.sortOrder) || 0;
    if (req.body.audience !== undefined) {
      if (!AUDIENCES.includes(req.body.audience)) {
        return res.status(400).json({ message: 'Audience must be men, women, or kids' });
      }
      data.audience = req.body.audience;
    }
    if (req.body.slug !== undefined || req.body.name !== undefined) {
      data.slug = slugify(req.body.slug || req.body.name || data.name);
    }
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data,
      include: { _count: { select: { products: true } } },
    });
    bust();
    res.json(serializeCategory(category));
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'That subcategory already exists for this department' });
    }
    res.status(500).json({ message: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const count = await prisma.product.count({ where: { categoryId: req.params.id } });
    if (count > 0) {
      return res.status(400).json({
        message: `Cannot delete — ${count} product${count === 1 ? '' : 's'} still use this subcategory`,
      });
    }
    await prisma.category.delete({ where: { id: req.params.id } });
    bust();
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
