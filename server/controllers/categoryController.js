const prisma = require('../lib/prisma');
const cache = require('../lib/cache');
const { slugify, serializeCategory, AUDIENCES } = require('../utils/catalog');

const bust = () => {
  cache.invalidate('categories');
  cache.invalidate('products');
  cache.invalidate('product');
};

const categoryInclude = {
  _count: { select: { products: true, children: true } },
  parent: { select: { id: true, name: true, slug: true } },
};

const listCategories = async (req, res) => {
  try {
    const { audience } = req.query;
    const where = {};
    if (audience && AUDIENCES.includes(audience)) where.audience = audience;
    const rows = await prisma.category.findMany({
      where,
      include: categoryInclude,
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
    if (!name) return res.status(400).json({ message: 'Name is required' });

    let audience = String(req.body.audience || '').trim();
    let parentId = req.body.parentId ? String(req.body.parentId) : null;

    if (parentId) {
      const parent = await prisma.category.findUnique({ where: { id: parentId } });
      if (!parent) return res.status(400).json({ message: 'Parent category not found' });
      if (parent.parentId) {
        return res.status(400).json({ message: 'Subcategories cannot have their own subcategories' });
      }
      audience = parent.audience;
      parentId = parent.id;
    }

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
        parentId,
        sortOrder: Number(req.body.sortOrder) || 0,
      },
      include: categoryInclude,
    });
    bust();
    res.status(201).json(serializeCategory(category));
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'That name/slug already exists in this department' });
    }
    res.status(500).json({ message: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const existing = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: { children: { select: { id: true } } },
    });
    if (!existing) return res.status(404).json({ message: 'Category not found' });

    const data = {};
    if (req.body.name !== undefined) data.name = String(req.body.name).trim();
    if (req.body.sortOrder !== undefined) data.sortOrder = Number(req.body.sortOrder) || 0;

    if (req.body.parentId !== undefined) {
      const nextParent = req.body.parentId ? String(req.body.parentId) : null;
      if (nextParent === existing.id) {
        return res.status(400).json({ message: 'A category cannot be its own parent' });
      }
      if (nextParent && existing.children.some((c) => c.id === nextParent)) {
        return res.status(400).json({ message: 'Cannot nest a category under its subcategory' });
      }
      if (nextParent) {
        const parent = await prisma.category.findUnique({ where: { id: nextParent } });
        if (!parent) return res.status(400).json({ message: 'Parent category not found' });
        if (parent.parentId) {
          return res.status(400).json({ message: 'Subcategories cannot have their own subcategories' });
        }
        if (existing.children.length > 0) {
          return res.status(400).json({
            message: 'Move or delete subcategories before nesting this category',
          });
        }
        data.parentId = parent.id;
        data.audience = parent.audience;
      } else {
        data.parentId = null;
      }
    }

    if (req.body.audience !== undefined && data.parentId === undefined && !existing.parentId) {
      if (!AUDIENCES.includes(req.body.audience)) {
        return res.status(400).json({ message: 'Audience must be men, women, or kids' });
      }
      data.audience = req.body.audience;
      // Keep children in the same department
      if (existing.children.length) {
        await prisma.category.updateMany({
          where: { parentId: existing.id },
          data: { audience: req.body.audience },
        });
      }
    }

    if (req.body.slug !== undefined || req.body.name !== undefined) {
      data.slug = slugify(req.body.slug || req.body.name || data.name || existing.name);
    }

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data,
      include: categoryInclude,
    });
    bust();
    res.json(serializeCategory(category));
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'That name/slug already exists in this department' });
    }
    res.status(500).json({ message: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const row = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { products: true, children: true } },
      },
    });
    if (!row) return res.status(404).json({ message: 'Category not found' });

    if (row._count.children > 0) {
      return res.status(400).json({
        message: `Cannot delete — ${row._count.children} subcategor${
          row._count.children === 1 ? 'y' : 'ies'
        } still exist under this category`,
      });
    }

    if (row._count.products > 0) {
      return res.status(400).json({
        message: `Cannot delete — ${row._count.products} product${
          row._count.products === 1 ? '' : 's'
        } still use this ${row.parentId ? 'subcategory' : 'category'}`,
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
