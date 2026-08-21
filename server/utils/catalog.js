const AUDIENCES = ['men', 'women', 'kids'];

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

const DEFAULT_CATEGORIES = [
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
  return TYPE_FROM_SLUG[category.slug] || fallback;
};

const serializeCategory = (c) => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  audience: c.audience,
  sortOrder: c.sortOrder,
  productCount: c._count?.products ?? c.productCount,
});

const ratingSummary = (reviews = []) => {
  const visible = reviews.filter((r) => r.isVisible !== false);
  if (!visible.length) return { ratingAvg: 0, reviewCount: 0 };
  const sum = visible.reduce((n, r) => n + (Number(r.rating) || 0), 0);
  return {
    ratingAvg: Math.round((sum / visible.length) * 10) / 10,
    reviewCount: visible.length,
  };
};

const ensureDefaultCategories = async (prisma) => {
  const count = await prisma.category.count();
  if (count === 0) {
    await prisma.category.createMany({ data: DEFAULT_CATEGORIES });
  }

  const categories = await prisma.category.findMany();
  const byAudienceSlug = Object.fromEntries(
    categories.map((c) => [`${c.audience}:${c.slug}`, c])
  );

  const uncategorized = await prisma.product.findMany({
    where: { categoryId: null },
    select: { id: true, type: true, audience: true },
  });
  for (const product of uncategorized) {
    const slug = TYPE_TO_SLUG[product.type] || 'boxers';
    const audience = product.audience || 'men';
    const category =
      byAudienceSlug[`${audience}:${slug}`] || byAudienceSlug[`men:${slug}`];
    if (!category) continue;
    await prisma.product.update({
      where: { id: product.id },
      data: { audience, categoryId: category.id },
    });
  }
};

module.exports = {
  slugify,
  AUDIENCES,
  TYPE_FROM_SLUG,
  TYPE_TO_SLUG,
  DEFAULT_CATEGORIES,
  typeFromCategory,
  serializeCategory,
  ratingSummary,
  ensureDefaultCategories,
};
