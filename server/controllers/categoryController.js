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

const isRootCategory = (row) => Boolean(row && !row.parentId);

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

    const parentId = req.body.parentId ? String(req.body.parentId) : null;

    // Subcategory under a root category
    if (parentId) {
      const parent = await prisma.category.findUnique({ where: { id: parentId } });
      if (!parent) return res.status(400).json({ message: 'Category not found' });
      if (parent.parentId) {
        return res.status(400).json({ message: 'Choose a top-level category as the parent' });
      }

      const slug = slugify(req.body.slug || name);
      if (!slug) return res.status(400).json({ message: 'A valid slug is required' });
      if (AUDIENCES.includes(slug)) {
        return res.status(400).json({ message: 'That slug is reserved for a main category' });
      }

      const category = await prisma.category.create({
        data: {
          name,
          slug,
          audience: parent.audience,
          parentId: parent.id,
          sortOrder: Number(req.body.sortOrder) || 0,
        },
        include: categoryInclude,
      });
      bust();
      return res.status(201).json(serializeCategory(category));
    }

    // Top-level category
    const slug = slugify(req.body.slug || name);
    if (!slug) return res.status(400).json({ message: 'A valid slug is required' });

    let audience = String(req.body.audience || '').trim();
    if (AUDIENCES.includes(slug)) {
      audience = slug;
    }
    if (!AUDIENCES.includes(audience)) {
      return res.status(400).json({
        message: 'Pick an audience for this category (Men, Women, or Kids)',
      });
    }

    // Men / Women / Kids: only one root each
    if (AUDIENCES.includes(slug)) {
      const existingRoot = await prisma.category.findFirst({
        where: { audience, parentId: null, slug },
      });
      if (existingRoot) {
        return res.status(400).json({
          message: `${existingRoot.name} already exists — add a subcategory under it instead`,
        });
      }
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        audience,
        parentId: null,
        imageUrl: req.body.imageUrl ? String(req.body.imageUrl).trim() : null,
        statement: req.body.statement
          ? String(req.body.statement).trim().slice(0, 200)
          : null,
        sortOrder:
          Number(req.body.sortOrder) ||
          (AUDIENCES.includes(slug) ? AUDIENCES.indexOf(slug) : 10),
      },
      include: categoryInclude,
    });
    bust();
    res.status(201).json(serializeCategory(category));
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'A category with that slug already exists' });
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

    const isRoot = isRootCategory(existing);
    const data = {};

    if (req.body.name !== undefined) data.name = String(req.body.name).trim();
    if (req.body.sortOrder !== undefined) data.sortOrder = Number(req.body.sortOrder) || 0;
    if (req.body.imageUrl !== undefined) {
      data.imageUrl = req.body.imageUrl ? String(req.body.imageUrl).trim() : null;
    }
    if (req.body.statement !== undefined) {
      data.statement = req.body.statement ? String(req.body.statement).trim().slice(0, 200) : null;
    }

    if (!isRoot) {
      if (req.body.parentId !== undefined) {
        const nextParent = req.body.parentId ? String(req.body.parentId) : null;
        if (!nextParent) {
          return res.status(400).json({ message: 'Subcategories must stay under a category' });
        }
        const parent = await prisma.category.findUnique({ where: { id: nextParent } });
        if (!parent || parent.parentId) {
          return res.status(400).json({ message: 'Choose a top-level category as the parent' });
        }
        data.parentId = parent.id;
        data.audience = parent.audience;
      }
      if (req.body.slug !== undefined || req.body.name !== undefined) {
        const slug = slugify(req.body.slug || req.body.name || data.name || existing.name);
        if (AUDIENCES.includes(slug)) {
          return res.status(400).json({ message: 'That slug is reserved for a main category' });
        }
        data.slug = slug;
      }
    } else {
      // Keep men/women/kids slugs locked; allow custom root slugs to change
      if (AUDIENCES.includes(existing.slug)) {
        data.slug = existing.slug;
      } else if (req.body.slug !== undefined || req.body.name !== undefined) {
        const slug = slugify(req.body.slug || req.body.name || data.name || existing.name);
        if (!slug) return res.status(400).json({ message: 'A valid slug is required' });
        if (AUDIENCES.includes(slug)) {
          return res.status(400).json({ message: 'That slug is reserved for Men, Women, or Kids' });
        }
        data.slug = slug;
      }
      if (req.body.audience !== undefined && AUDIENCES.includes(String(req.body.audience))) {
        data.audience = String(req.body.audience);
      }
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
      return res.status(400).json({ message: 'A category with that slug already exists' });
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

    const isRoot = isRootCategory(row);
    if (isRoot && AUDIENCES.includes(row.slug)) {
      return res.status(400).json({
        message: 'Men, Women, and Kids cannot be deleted — remove their subcategories instead',
      });
    }

    if (row._count.children > 0) {
      return res.status(400).json({
        message: `Cannot delete — ${row._count.children} subcategor${
          row._count.children === 1 ? 'y' : 'ies'
        } still exist`,
      });
    }

    if (row._count.products > 0) {
      return res.status(400).json({
        message: `Cannot delete — ${row._count.products} product${
          row._count.products === 1 ? '' : 's'
        } still use this ${isRoot ? 'category' : 'subcategory'}`,
      });
    }

    await prisma.category.delete({ where: { id: row.id } });
    bust();
    res.json({ message: isRoot ? 'Category deleted' : 'Subcategory deleted' });
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
