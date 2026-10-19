const prisma = require('../lib/prisma');
const cache = require('../lib/cache');

/** buy = units paid for in each group, pct = discount on the extra unit. */
const OFFER_TYPES = {
  buy1get1_free: { buy: 1, pct: 100, label: 'Buy 1 Get 1 Free' },
  buy2get1_free: { buy: 2, pct: 100, label: 'Buy 2 Get 1 Free' },
  buy1get1_half: { buy: 1, pct: 50, label: 'Buy 1 Get 1 50% Off' },
  buy2get1_half: { buy: 2, pct: 50, label: 'Buy 2 Get 1 50% Off' },
};

/** Average saving per unit; the most generous offer claims units first. */
const generosity = (type) => {
  const t = OFFER_TYPES[type];
  return t ? t.pct / (t.buy + 1) : 0;
};

const round2 = (n) => Math.round(n * 100) / 100;

const offerCovers = (offer, productId) => {
  if (!offer || offer.isActive === false) return false;
  if (offer.appliesTo !== 'selected') return true;
  const id = String(productId || '');
  return (offer.productIds || []).some((pid) => String(pid) === id);
};

/**
 * lines: [{ productId, price, qty }] at the unit price the customer pays.
 * Each unit joins at most one offer. Within an offer, units are sorted by price
 * (high → low) and chunked into groups of buy + 1; the last (cheapest) unit of
 * every full group is discounted, so the store never gives away the pricier item.
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
    .filter((o) => o && o.isActive !== false && OFFER_TYPES[o.type])
    .sort((a, b) => generosity(b.type) - generosity(a.type));

  const applied = [];
  let total = 0;
  for (const offer of sorted) {
    const { buy, pct } = OFFER_TYPES[offer.type];
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
      name: offer.name || OFFER_TYPES[offer.type].label,
      type: offer.type,
      discount,
      units: groups,
    });
  }

  return { discount: round2(total), applied };
};

const OFFERS_CACHE_KEY = 'offers-active';

const getActiveOffers = async () => {
  const { data } = await cache.wrap(OFFERS_CACHE_KEY, 60_000, () =>
    prisma.offer.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, type: true, appliesTo: true, productIds: true, isActive: true },
    })
  );
  return data;
};

const invalidateOffers = () => cache.invalidate(OFFERS_CACHE_KEY);

module.exports = {
  OFFER_TYPES,
  applyOffers,
  getActiveOffers,
  invalidateOffers,
  round2,
};
