const prisma = require('../lib/prisma');
const cache = require('../lib/cache');

/**
 * buy = units paid for in each group, pct = discount on the extra unit.
 * percent_off has buy 0 (every covered unit is its own group) and takes its pct
 * from the offer's own `percentage`.
 */
const OFFER_TYPES = {
  buy1get1_free: { buy: 1, pct: 100, label: 'Buy 1 Get 1 Free' },
  buy2get1_free: { buy: 2, pct: 100, label: 'Buy 2 Get 1 Free' },
  buy1get1_half: { buy: 1, pct: 50, label: 'Buy 1 Get 1 50% Off' },
  buy2get1_half: { buy: 2, pct: 50, label: 'Buy 2 Get 1 50% Off' },
  percent_off: { buy: 0, pct: null, label: '% Off' },
};

const OFFER_SCOPES = ['all', 'category', 'subcategory', 'selected'];

const MIN_PERCENT = 1;
const MAX_PERCENT = 90;

const clampPercent = (n) => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return null;
  return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, v));
};

/** Discount % on each discounted unit of this offer (0 when invalid). */
const offerPct = (offer) => {
  const t = OFFER_TYPES[offer?.type];
  if (!t) return 0;
  if (offer.type === 'percent_off') return clampPercent(offer.percentage) || 0;
  return t.pct;
};

const offerLabel = (offer) => {
  if (offer?.type === 'percent_off') return `${offerPct(offer)}% Off`;
  return OFFER_TYPES[offer?.type]?.label || 'Offer';
};

/** Average saving per unit; the most generous offer claims units first. */
const generosity = (offer) => {
  const t = OFFER_TYPES[offer?.type];
  return t ? offerPct(offer) / (t.buy + 1) : 0;
};

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Category scopes are expanded to product ids by getActiveOffers, so coverage is
 * always a product-id check outside of "all".
 */
const offerCovers = (offer, productId) => {
  if (!offer || offer.isActive === false) return false;
  if (!offer.appliesTo || offer.appliesTo === 'all') return true;
  const id = String(productId || '');
  return (offer.productIds || []).some((pid) => String(pid) === id);
};

/**
 * lines: [{ productId, price, qty }] at the unit price the customer pays.
 * Each unit joins at most one offer. Within an offer, units are sorted by price
 * (high → low) and chunked into groups of buy + 1; the last (cheapest) unit of
 * every full group is discounted, so the store never gives away the pricier item.
 * For percent_off the group size is 1, so every covered unit is discounted.
 */
const applyOffers = (lines, offers) => {
  const units = [];
  for (const line of lines || []) {
    const qty = Math.max(0, Math.floor(Number(line.qty) || 0));
    const price = Number(line.price) || 0;
    const productId = String(line.productId || '');
    if (!productId || qty < 1 || price < 0) continue;
    for (let i = 0; i < qty; i += 1) {
      units.push({ productId, price, used: false });
    }
  }

  const sorted = [...(offers || [])]
    .filter((o) => o && o.isActive !== false && OFFER_TYPES[o.type] && offerPct(o) > 0)
    .sort((a, b) => generosity(b) - generosity(a));

  const applied = [];
  let total = 0;
  for (const offer of sorted) {
    const { buy } = OFFER_TYPES[offer.type];
    const pct = offerPct(offer);
    const groupSize = buy + 1;
    const eligible = units
      .filter((u) => !u.used && offerCovers(offer, u.productId))
      .sort((a, b) => b.price - a.price || a.productId.localeCompare(b.productId));
    const groups = Math.floor(eligible.length / groupSize);
    if (!groups) continue;

    let discount = 0;
    for (let g = 0; g < groups; g += 1) {
      const group = eligible.slice(g * groupSize, (g + 1) * groupSize);
      group.forEach((u) => {
        u.used = true;
      });
      // Cheapest unit in the group (last after high→low sort) is the discounted one
      discount += (group[group.length - 1].price * pct) / 100;
    }
    discount = round2(discount);
    if (discount <= 0) continue;
    total += discount;
    applied.push({
      offerId: offer.id,
      name: offer.name || offerLabel(offer),
      type: offer.type,
      ...(offer.type === 'percent_off' ? { percentage: pct } : {}),
      discount,
      units: groups,
    });
  }

  return { discount: round2(total), applied };
};

/** Category ids plus every subcategory under them. */
const expandCategoryIds = (ids, categories) => {
  const wanted = new Set((ids || []).map(String));
  for (const c of categories) {
    if (c.parentId && wanted.has(String(c.parentId))) wanted.add(String(c.id));
  }
  return wanted;
};

/** Resolve category / subcategory scopes to the product ids they cover right now. */
const resolveOfferProducts = async (offers) => {
  const scoped = offers.filter((o) => o.appliesTo === 'category' || o.appliesTo === 'subcategory');
  if (!scoped.length) return offers;

  const categories = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const catSets = scoped.map((o) => expandCategoryIds(o.categoryIds, categories));
  const allCats = [...new Set(catSets.flatMap((s) => [...s]))];
  const products = allCats.length
    ? await prisma.product.findMany({
        where: { categoryId: { in: allCats } },
        select: { id: true, categoryId: true },
      })
    : [];

  const byOffer = new Map(
    scoped.map((o, i) => [
      o.id,
      products.filter((p) => catSets[i].has(String(p.categoryId))).map((p) => p.id),
    ])
  );
  return offers.map((o) => (byOffer.has(o.id) ? { ...o, productIds: byOffer.get(o.id) } : o));
};

const OFFERS_CACHE_KEY = 'offers-active';

/** Active offers with category scopes already expanded into productIds. */
const getActiveOffers = async () => {
  const { data } = await cache.wrap(OFFERS_CACHE_KEY, 60_000, async () => {
    const rows = await prisma.offer.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        percentage: true,
        appliesTo: true,
        productIds: true,
        categoryIds: true,
        isActive: true,
      },
    });
    return resolveOfferProducts(rows);
  });
  return data;
};

const invalidateOffers = () => cache.invalidate(OFFERS_CACHE_KEY);

module.exports = {
  OFFER_TYPES,
  OFFER_SCOPES,
  MIN_PERCENT,
  MAX_PERCENT,
  clampPercent,
  offerLabel,
  applyOffers,
  getActiveOffers,
  invalidateOffers,
  round2,
};
