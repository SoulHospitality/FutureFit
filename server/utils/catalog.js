const AUDIENCES = ['men', 'women', 'boys', 'girls', 'baby'];

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
    audience: 'boys',
    name: 'Boys',
    slug: 'boys',
    sortOrder: 2,
    statement: 'Comfortable staples sized for growing boys.',
  },
  {
    audience: 'girls',
    name: 'Girls',
    slug: 'girls',
    sortOrder: 3,
    statement: 'Soft everyday pieces for growing girls.',
  },
  {
    audience: 'baby',
    name: 'Baby',
    slug: 'baby',
    sortOrder: 4,
    statement: 'Gentle cotton sets for the littlest ones.',
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
  'underwear-sets': 'bundle',
  't-shirts': 'undershirt',
  shirts: 'undershirt',
  hoodies: 'undershirt',
  pants: 'boxers',
  leggings: 'briefs',
  dresses: 'briefs',
  panties: 'briefs',
  panty: 'briefs',
  pajamas: 'boxers',
  'sleepwear-loungewear': 'boxers',
  'denim-shorts': 'trunks',
  shorts: 'trunks',
  undershorts: 'trunks',
  thermals: 'boxers',
};

/** Map CLR / sheet audiences onto storefront departments. */
const AUDIENCE_ALIASES = {
  men: 'men',
  women: 'women',
  boys: 'boys',
  girls: 'girls',
  baby: 'baby',
  babies: 'baby',
  kids: 'boys', // legacy sheet/db value → Boys
  kid: 'boys',
};

/** Normalize category slugs from import sheets. */
const CATEGORY_ALIASES = {
  panty: 'panties',
  pantie: 'panties',
  shirt: 'shirts',
  'underwear-set': 'underwear-sets',
  'underwear set': 'underwear-sets',
};

const normalizeAudience = (value) => {
  const key = String(value || '')
    .trim()
    .toLowerCase();
  return AUDIENCE_ALIASES[key] || (AUDIENCES.includes(key) ? key : null);
};

const normalizeCategorySlug = (value) => {
  const raw = slugify(value);
  if (!raw) return '';
  return CATEGORY_ALIASES[raw] || raw;
};

const TYPE_TO_SLUG = {
  boxers: 'boxers',
  briefs: 'briefs',
  trunks: 'undershorts',
  undershirt: 't-shirts',
  socks: 'socks',
  bundle: 'boxers',
};

/** Shop merchandising sort field per department. */
const SHOP_SORT_FIELD = {
  men: 'shopSortMen',
  women: 'shopSortWomen',
  boys: 'shopSortBoys',
  girls: 'shopSortGirls',
  baby: 'shopSortBaby',
};

const shopSortFieldFor = (audience) => SHOP_SORT_FIELD[audience] || 'shopSortMen';

/**
 * Subcategories nested under each department root.
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
  { audience: 'men', name: 'Shorts', slug: 'shorts', sortOrder: 7 },
  { audience: 'men', name: 'Thermals', slug: 'thermals', sortOrder: 8 },
  { audience: 'men', name: 'Undershirts', slug: 'undershirts', sortOrder: 9 },
  { audience: 'men', name: 'Pajamas', slug: 'pajamas', sortOrder: 10 },
  { audience: 'men', name: 'Sleepwear & Loungewear', slug: 'sleepwear-loungewear', sortOrder: 11 },
  // Women
  { audience: 'women', name: "Women's Undershirts", slug: 'womens-undershirts', sortOrder: 0 },
  { audience: 'women', name: 'Undershirts', slug: 'undershirts', sortOrder: 1 },
  { audience: 'women', name: 'Panties', slug: 'panties', sortOrder: 2 },
  { audience: 'women', name: 'Dresses', slug: 'dresses', sortOrder: 3 },
  { audience: 'women', name: 'Leggings', slug: 'leggings', sortOrder: 4 },
  { audience: 'women', name: 'Socks', slug: 'socks', sortOrder: 5 },
  { audience: 'women', name: 'T-Shirts', slug: 't-shirts', sortOrder: 6 },
  { audience: 'women', name: 'Hoodies', slug: 'hoodies', sortOrder: 7 },
  { audience: 'women', name: 'Pants', slug: 'pants', sortOrder: 8 },
  { audience: 'women', name: 'Denim Shorts', slug: 'denim-shorts', sortOrder: 9 },
  { audience: 'women', name: 'Pajamas', slug: 'pajamas', sortOrder: 10 },
  { audience: 'women', name: 'Sleepwear & Loungewear', slug: 'sleepwear-loungewear', sortOrder: 11 },
  // Boys
  { audience: 'boys', name: 'Boxers', slug: 'boxers', sortOrder: 0 },
  { audience: 'boys', name: 'Undershirts', slug: 'undershirts', sortOrder: 1 },
  { audience: 'boys', name: 'Shirts', slug: 'shirts', sortOrder: 2 },
  { audience: 'boys', name: 'Undershorts', slug: 'undershorts', sortOrder: 3 },
  { audience: 'boys', name: 'Socks', slug: 'socks', sortOrder: 4 },
  { audience: 'boys', name: 'T-Shirts', slug: 't-shirts', sortOrder: 5 },
  { audience: 'boys', name: 'Hoodies', slug: 'hoodies', sortOrder: 6 },
  { audience: 'boys', name: 'Pants', slug: 'pants', sortOrder: 7 },
  { audience: 'boys', name: 'Shorts', slug: 'shorts', sortOrder: 8 },
  { audience: 'boys', name: 'Pajamas', slug: 'pajamas', sortOrder: 9 },
  // Girls
  { audience: 'girls', name: 'Panties', slug: 'panties', sortOrder: 0 },
  { audience: 'girls', name: 'Socks', slug: 'socks', sortOrder: 1 },
  { audience: 'girls', name: 'T-Shirts', slug: 't-shirts', sortOrder: 2 },
  { audience: 'girls', name: 'Undershirts', slug: 'undershirts', sortOrder: 3 },
  { audience: 'girls', name: 'Leggings', slug: 'leggings', sortOrder: 4 },
  { audience: 'girls', name: 'Hoodies', slug: 'hoodies', sortOrder: 5 },
  { audience: 'girls', name: 'Pajamas', slug: 'pajamas', sortOrder: 6 },
  { audience: 'girls', name: 'Sleepwear & Loungewear', slug: 'sleepwear-loungewear', sortOrder: 7 },
  // Baby
  { audience: 'baby', name: 'Underwear Sets', slug: 'underwear-sets', sortOrder: 0 },
  { audience: 'baby', name: 'Socks', slug: 'socks', sortOrder: 1 },
  { audience: 'baby', name: 'Bodysuits', slug: 'bodysuits', sortOrder: 2 },
  { audience: 'baby', name: 'Pajamas', slug: 'pajamas', sortOrder: 3 },
];

const typeFromCategory = (category, fallback = 'boxers') => {
  if (!category?.slug) return fallback;
  if (AUDIENCES.includes(category.slug)) return fallback;
  return TYPE_FROM_SLUG[category.slug] || fallback;
};

const serializeCategory = (c) => {
  const isCategory = !c.parentId;
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
    sizeChartUrl: c.sizeChartUrl || null,
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
 * Remap legacy `kids` audience rows (raw SQL — works after enum drop from Prisma schema).
 * Safe to call repeatedly; no-ops when kids is already gone.
 */
const migrateLegacyKidsAudience = async (prisma) => {
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE "Product"
      SET audience = CASE
        WHEN name ~* '(baby|infant|newborn|underwear set)' THEN 'baby'::"Audience"
        WHEN name ~* '(girl|pant(y|ies))' THEN 'girls'::"Audience"
        ELSE 'boys'::"Audience"
      END
      WHERE audience::text = 'kids'
    `);
  } catch {
    /* enum value already removed */
  }

  try {
    await prisma.$executeRawUnsafe(`
      UPDATE "Product" p
      SET "categoryId" = NULL
      FROM "Category" c
      WHERE p."categoryId" = c.id
        AND (c.audience::text = 'kids' OR c.slug = 'kids')
    `);
    await prisma.$executeRawUnsafe(`
      DELETE FROM "Category"
      WHERE audience::text = 'kids' OR slug = 'kids'
    `);
  } catch {
    /* already cleaned */
  }
};

/**
 * Categories = department roots. Subcategories = catalog types nested under a root.
 */
const ensureDefaultCategories = async (prisma) => {
  await migrateLegacyKidsAudience(prisma);

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
      update: {
        name: root.name,
        sortOrder: root.sortOrder,
        statement: root.statement,
      },
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

  // Remove legacy Kids root if any remain (slug match avoids invalid enum literals).
  try {
    await prisma.category.deleteMany({ where: { slug: 'kids' } });
  } catch {
    /* ignore */
  }

  let all = await prisma.category.findMany({
    include: { parent: { select: { id: true, parentId: true, audience: true } } },
  });

  const rootByAudience = Object.fromEntries(
    all.filter((c) => !c.parentId && AUDIENCES.includes(c.slug)).map((c) => [c.audience, c])
  );

  // Flatten any accidental nesting under non-root parents.
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
    } else if (existing.name !== sub.name || existing.sortOrder !== sub.sortOrder) {
      await prisma.category.update({
        where: { id: existing.id },
        data: { name: sub.name, sortOrder: sub.sortOrder },
      });
    }
  }

  // Attach uncategorized products to a default sub for their audience.
  const uncategorized = await prisma.product.findMany({
    where: { categoryId: null },
    select: { id: true, type: true, audience: true },
  });
  for (const product of uncategorized) {
    const slug = TYPE_TO_SLUG[product.type] || 'boxers';
    const audience = normalizeAudience(product.audience) || 'men';
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
  SHOP_SORT_FIELD,
  AUDIENCE_ALIASES,
  CATEGORY_ALIASES,
  DEFAULT_SUBCATEGORIES,
  DEFAULT_CATEGORIES: DEFAULT_SUBCATEGORIES,
  normalizeAudience,
  normalizeCategorySlug,
  shopSortFieldFor,
  typeFromCategory,
  serializeCategory,
  ratingSummary,
  migrateLegacyKidsAudience,
  ensureDefaultCategories,
};
