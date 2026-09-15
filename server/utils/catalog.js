const AUDIENCES = ['men', 'women', 'kids'];

const ROOT_CATEGORIES = [
  { audience: 'men', name: 'Men', slug: 'men', sortOrder: 0 },
  { audience: 'women', name: 'Women', slug: 'women', sortOrder: 1 },
  { audience: 'kids', name: 'Kids', slug: 'kids', sortOrder: 2 },
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
  socks: 'socks',
  bundles: 'bundle',
  bundle: 'bundle',
};

const TYPE_TO_SLUG = {
  boxers: 'boxers',
  briefs: 'briefs',
  trunks: 'trunks',
  undershirt: 'undershirts',
  socks: 'socks',
  bundle: 'bundles',
};

/** Subcategories seeded under Men / Women / Kids. */
const DEFAULT_SUBCATEGORIES = [
  { audience: 'men', name: 'Boxers', slug: 'boxers', sortOrder: 0 },
  { audience: 'men', name: 'Briefs', slug: 'briefs', sortOrder: 1 },
  { audience: 'men', name: 'Trunks', slug: 'trunks', sortOrder: 2 },
  { audience: 'men', name: 'Undershirts', slug: 'undershirts', sortOrder: 3 },
  { audience: 'men', name: 'Socks', slug: 'socks', sortOrder: 4 },
  { audience: 'men', name: 'Bundles', slug: 'bundles', sortOrder: 5 },
  { audience: 'women', name: 'Tops', slug: 'tops', sortOrder: 0 },
  { audience: 'women', name: 'Bottoms', slug: 'bottoms', sortOrder: 1 },
  { audience: 'women', name: 'Underwear', slug: 'underwear', sortOrder: 2 },
  { audience: 'kids', name: 'Tops', slug: 'tops', sortOrder: 0 },
  { audience: 'kids', name: 'Bottoms', slug: 'bottoms', sortOrder: 1 },
  { audience: 'kids', name: 'Underwear', slug: 'underwear', sortOrder: 2 },
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
 * Subcategories = Boxers, Trunks, etc. nested under a root.
 */
const ensureDefaultCategories = async (prisma) => {
  for (const root of ROOT_CATEGORIES) {
    await prisma.category.upsert({
      where: { audience_slug: { audience: root.audience, slug: root.slug } },
      create: { ...root, parentId: null },
      update: {},
    });
  }

  let all = await prisma.category.findMany();
  const rootByAudience = Object.fromEntries(
    all
      .filter((c) => !c.parentId && AUDIENCES.includes(c.slug))
      .map((c) => [c.audience, c])
  );

  // Nest any legacy top-level rows (Boxers, Tops, …) under the matching category root.
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
  // Flatten accidental 3rd level → hang under the audience root.
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
          data: { parentId: root.id },
        });
        byAudienceSlug[key] = updated;
      }
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
