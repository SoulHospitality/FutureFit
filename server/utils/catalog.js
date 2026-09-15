const AUDIENCES = ['men', 'women', 'kids'];

const ROOT_CATEGORIES = [
  {
    audience: 'men',
    name: 'Men',
    slug: 'men',
    sortOrder: 0,
    statement: 'Underwear, undershirts, and everyday essentials.',
  },
  {
    audience: 'women',
    name: 'Women',
    slug: 'women',
    sortOrder: 1,
    statement: 'Pieces cut for ease, presence, and all-day wear.',
  },
  {
    audience: 'kids',
    name: 'Kids',
    slug: 'kids',
    sortOrder: 2,
    statement: 'Soft staples sized for growing days.',
  },
];

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const TYPE_FROM_SLUG = {
  boxers: 'boxers',
  briefs: 'briefs',
  trunks: 'trunks',
  undershirts: 'undershirt',
  undershirt: 'undershirt',
  'womens-undershirts': 'undershirt',
  socks: 'socks',
  bundles: 'bundle',
  bundle: 'bundle',
  't-shirts': 'undershirt',
  hoodies: 'undershirt',
  pants: 'boxers',
  leggings: 'briefs',
  dresses: 'briefs',
  pajamas: 'boxers',
  'sleepwear-loungewear': 'boxers',
  'denim-shorts': 'trunks',
  undershorts: 'trunks',
};

const TYPE_TO_SLUG = {
  boxers: 'boxers',
  briefs: 'briefs',
  trunks: 'undershorts',
  undershirt: 't-shirts',
  socks: 'socks',
  bundle: 'boxers',
};

/**
 * Subcategories from the catalog, matched to Men / Women / Kids.
 * Shared styles are listed under each relevant category.
 */
const DEFAULT_SUBCATEGORIES = [
  // Men
  { audience: 'men', name: 'Boxers', slug: 'boxers', sortOrder: 0 },
  { audience: 'men', name: 'Undershorts', slug: 'undershorts', sortOrder: 1 },
  { audience: 'men', name: 'Socks', slug: 'socks', sortOrder: 2 },
  { audience: 'men', name: 'T-Shirts', slug: 't-shirts', sortOrder: 3 },
  { audience: 'men', name: 'Hoodies', slug: 'hoodies', sortOrder: 4 },
  { audience: 'men', name: 'Pants', slug: 'pants', sortOrder: 5 },
  { audience: 'men', name: 'Denim Shorts', slug: 'denim-shorts', sortOrder: 6 },
  { audience: 'men', name: 'Pajamas', slug: 'pajamas', sortOrder: 7 },
  { audience: 'men', name: 'Sleepwear & Loungewear', slug: 'sleepwear-loungewear', sortOrder: 8 },
  // Women
  { audience: 'women', name: "Women's Undershirts", slug: 'womens-undershirts', sortOrder: 0 },
  { audience: 'women', name: 'Dresses', slug: 'dresses', sortOrder: 1 },
  { audience: 'women', name: 'Leggings', slug: 'leggings', sortOrder: 2 },
  { audience: 'women', name: 'Socks', slug: 'socks', sortOrder: 3 },
  { audience: 'women', name: 'T-Shirts', slug: 't-shirts', sortOrder: 4 },
  { audience: 'women', name: 'Hoodies', slug: 'hoodies', sortOrder: 5 },
  { audience: 'women', name: 'Pants', slug: 'pants', sortOrder: 6 },
  { audience: 'women', name: 'Denim Shorts', slug: 'denim-shorts', sortOrder: 7 },
  { audience: 'women', name: 'Pajamas', slug: 'pajamas', sortOrder: 8 },
  { audience: 'women', name: 'Sleepwear & Loungewear', slug: 'sleepwear-loungewear', sortOrder: 9 },
  // Kids
  { audience: 'kids', name: 'Undershorts', slug: 'undershorts', sortOrder: 0 },
  { audience: 'kids', name: 'Socks', slug: 'socks', sortOrder: 1 },
  { audience: 'kids', name: 'T-Shirts', slug: 't-shirts', sortOrder: 2 },
  { audience: 'kids', name: 'Hoodies', slug: 'hoodies', sortOrder: 3 },
  { audience: 'kids', name: 'Pants', slug: 'pants', sortOrder: 4 },
  { audience: 'kids', name: 'Denim Shorts', slug: 'denim-shorts', sortOrder: 5 },
  { audience: 'kids', name: 'Leggings', slug: 'leggings', sortOrder: 6 },
  { audience: 'kids', name: 'Pajamas', slug: 'pajamas', sortOrder: 7 },
  { audience: 'kids', name: 'Sleepwear & Loungewear', slug: 'sleepwear-loungewear', sortOrder: 8 },
];

const typeFromCategory = (category, fallback = 'boxers') => {
  if (!category?.slug) return fallback;
  if (AUDIENCES.includes(category.slug)) return fallback;
  return TYPE_FROM_SLUG[category.slug] || fallback;
};

const serializeCategory = (c) => {
  const isCategory = !c.parentId && AUDIENCES.includes(c.slug);
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    audience: c.audience,
    parentId: c.parentId || null,
    parent: c.parent
      ? { id: c.parent.id, name: c.parent.name, slug: c.parent.slug }
      : null,
    imageUrl: c.imageUrl || null,
    statement: c.statement || null,
    sortOrder: c.sortOrder,
    productCount: c._count?.products ?? c.productCount ?? 0,
    childCount: c._count?.children ?? c.childCount ?? 0,
    kind: isCategory ? 'category' : 'subcategory',
  };
};

const ratingSummary = (reviews = []) => {
  const visible = reviews.filter((r) => r.isVisible !== false);
  if (!visible.length) return { ratingAvg: 0, reviewCount: 0 };
  const sum = visible.reduce((n, r) => n + (Number(r.rating) || 0), 0);
  return {
    ratingAvg: Math.round((sum / visible.length) * 10) / 10,
    reviewCount: visible.length,
  };
};

/**
 * Categories = Men / Women / Kids (roots).
 * Subcategories = catalog types nested under a root.
 */
const ensureDefaultCategories = async (prisma) => {
  for (const root of ROOT_CATEGORIES) {
    await prisma.category.upsert({
      where: { audience_slug: { audience: root.audience, slug: root.slug } },
      create: {
        name: root.name,
        slug: root.slug,
        audience: root.audience,
        sortOrder: root.sortOrder,
        statement: root.statement,
        parentId: null,
      },
      update: {},
    });

    await prisma.category.updateMany({
      where: {
        audience: root.audience,
        slug: root.slug,
        OR: [{ statement: null }, { statement: '' }],
      },
      data: { statement: root.statement },
    });
  }

  let all = await prisma.category.findMany();
  const rootByAudience = Object.fromEntries(
    all
      .filter((c) => !c.parentId && AUDIENCES.includes(c.slug))
      .map((c) => [c.audience, c])
  );

  for (const row of all) {
    if (row.parentId) continue;
    if (AUDIENCES.includes(row.slug)) continue;
    const root = rootByAudience[row.audience];
    if (!root) continue;
    await prisma.category.update({
      where: { id: row.id },
      data: { parentId: root.id },
    });
  }

  all = await prisma.category.findMany({ include: { parent: true } });
  for (const row of all) {
    if (!row.parent?.parentId) continue;
    const root = rootByAudience[row.audience];
    if (!root || row.parentId === root.id) continue;
    await prisma.category.update({
      where: { id: row.id },
      data: { parentId: root.id },
    });
  }

  all = await prisma.category.findMany();
  const byAudienceSlug = Object.fromEntries(
    all.map((c) => [`${c.audience}:${c.slug}`, c])
  );

  for (const sub of DEFAULT_SUBCATEGORIES) {
    const root = rootByAudience[sub.audience];
    if (!root) continue;
    const key = `${sub.audience}:${sub.slug}`;
    const existing = byAudienceSlug[key];
    if (!existing) {
      const created = await prisma.category.create({
        data: { ...sub, parentId: root.id },
      });
      byAudienceSlug[key] = created;
    } else if (!existing.parentId || existing.parentId !== root.id) {
      if (!AUDIENCES.includes(existing.slug)) {
        const updated = await prisma.category.update({
          where: { id: existing.id },
          data: { parentId: root.id, name: sub.name, sortOrder: sub.sortOrder },
        });
        byAudienceSlug[key] = updated;
      }
    } else if (existing.name !== sub.name) {
      // Keep staff renames? Prefer seed names only on first create — skip rename
    }
  }

  const uncategorized = await prisma.product.findMany({
    where: { categoryId: null },
    select: { id: true, type: true, audience: true },
  });
  for (const product of uncategorized) {
    const slug = TYPE_TO_SLUG[product.type] || 'boxers';
    const audience = product.audience || 'men';
    const category =
      byAudienceSlug[`${audience}:${slug}`] || byAudienceSlug[`men:${slug}`];
    if (!category || AUDIENCES.includes(category.slug)) continue;
    await prisma.product.update({
      where: { id: product.id },
      data: { audience, categoryId: category.id },
    });
  }
};

module.exports = {
  slugify,
  AUDIENCES,
  ROOT_CATEGORIES,
  TYPE_FROM_SLUG,
  TYPE_TO_SLUG,
  DEFAULT_SUBCATEGORIES,
  DEFAULT_CATEGORIES: DEFAULT_SUBCATEGORIES,
  typeFromCategory,
  serializeCategory,
  ratingSummary,
  ensureDefaultCategories,
};
