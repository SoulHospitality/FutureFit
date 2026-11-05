import { useEffect, useSyncExternalStore } from 'react';
import api from '../api/axios';

/** Automatic offers (Buy X Get 1, or % off) set from Staff → Promotions. Checkout totals come from the server quote. */

export const OFFER_TYPES = {
  buy1get1_free: { buy: 1, pct: 100, label: 'Buy 1 Get 1 Free', hint: 'Add 2 — the cheaper one is free' },
  buy2get1_free: { buy: 2, pct: 100, label: 'Buy 2 Get 1 Free', hint: 'Add 3 — the cheapest one is free' },
  buy1get1_half: { buy: 1, pct: 50, label: 'Buy 1 Get 1 50% Off', hint: 'Add 2 — the cheaper one is half price' },
  buy2get1_half: { buy: 2, pct: 50, label: 'Buy 2 Get 1 50% Off', hint: 'Add 3 — the cheapest one is half price' },
  percent_off: { buy: 0, pct: null, label: '% Off', hint: 'Taken off automatically in your bag' },
};

export const OFFER_TYPE_KEYS = Object.keys(OFFER_TYPES);

/** Discount % on each discounted unit of this offer (0 when invalid). */
export const offerPct = (offer) => {
  const t = OFFER_TYPES[offer?.type];
  if (!t) return 0;
  if (offer.type === 'percent_off') {
    const v = Math.round(Number(offer.percentage));
    return Number.isFinite(v) ? Math.min(90, Math.max(0, v)) : 0;
  }
  return t.pct;
};

/** Badge text for an offer, e.g. "Buy 1 Get 1 Free" or "20% Off". */
export const offerLabel = (offer) => {
  if (offer?.type === 'percent_off') return `${offerPct(offer)}% Off`;
  return OFFER_TYPES[offer?.type]?.label || 'Offer';
};

const generosity = (offer) => {
  const t = OFFER_TYPES[offer?.type];
  return t ? offerPct(offer) / (t.buy + 1) : 0;
};

const round2 = (n) => Math.round(n * 100) / 100;

const usable = (o) => o && o.isActive !== false && OFFER_TYPES[o.type] && offerPct(o) > 0;

/** Category scopes come from the server already expanded into productIds. */
export const offerCovers = (offer, productId) => {
  if (!offer || offer.isActive === false) return false;
  if (!offer.appliesTo || offer.appliesTo === 'all') return true;
  const id = String(productId || '');
  return (offer.productIds || []).some((pid) => String(pid) === id);
};

/** Mirrors server/utils/offers.js so the bag can show savings before checkout. */
export function applyOffers(lines, offers) {
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

  const sorted = [...(offers || [])].filter(usable).sort((a, b) => generosity(b) - generosity(a));

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
      discount += (group[group.length - 1].price * pct) / 100;
    }
    discount = round2(discount);
    if (discount <= 0) continue;
    total += discount;
    applied.push({
      offerId: offer.id,
      name: offer.name || offerLabel(offer),
      type: offer.type,
      discount,
      units: groups,
    });
  }
  return { discount: round2(total), applied };
}

/** Best offer shown on a product (most generous first). */
export function offerForProduct(offers, productId) {
  if (!productId) return null;
  return (
    [...(offers || [])]
      .filter((o) => usable(o) && offerCovers(o, productId))
      .sort((a, b) => generosity(b) - generosity(a))[0] || null
  );
}

/**
 * Price a customer pays per unit once a percentage offer applies (the bag takes
 * the same % off the same price). Buy X Get 1 offers don't change a single
 * unit's price, so they return the price unchanged.
 */
export function priceAfterOffer(offer, price) {
  const base = Number(price) || 0;
  if (offer?.type !== 'percent_off') return base;
  return round2(base - (base * offerPct(offer)) / 100);
}

/**
 * Card / page pricing with sales and % offers combined.
 * Returns { price, was, pctOff }: `was` is set (and higher than `price`) only
 * when something is discounted, so callers show a struck-through old price.
 */
export function shownPricing({ listPrice, salePrice, offer }) {
  const list = Number(listPrice) || 0;
  const start = salePrice != null ? Number(salePrice) || 0 : list;
  const price = priceAfterOffer(offer, start);
  const was = list > price + 0.009 ? list : null;
  const pctOff = was ? Math.round((1 - price / was) * 100) : 0;
  return { price, was, pctOff };
}

/** One-line explainer under an offer badge on the product page. */
export function offerHintText(offer) {
  if (!offer) return '';
  if (offer.type === 'percent_off') {
    return `${offerPct(offer)}% off this item — taken off automatically in your bag.`;
  }
  const scope =
    offer.appliesTo && offer.appliesTo !== 'all'
      ? 'Mix & match with other items in this offer.'
      : 'Mix & match across the whole store.';
  return `${OFFER_TYPES[offer.type].hint}. ${scope}`;
}

/**
 * How many more eligible units until the next free/discounted unit unlocks.
 * Returns null when an offer is already applying or nothing is close.
 */
export function nextOfferHint(lines, offers) {
  const result = applyOffers(lines, offers);
  if (result.discount > 0) {
    const top = result.applied[0];
    if (!top) return null;
    return {
      kind: 'applied',
      message: `${top.name} applied`,
      discount: result.discount,
    };
  }

  const sorted = [...(offers || [])].filter(usable).sort((a, b) => generosity(b) - generosity(a));

  for (const offer of sorted) {
    const { buy } = OFFER_TYPES[offer.type];
    const groupSize = buy + 1;
    // A % off applies to every unit, so there is never "one more" to add
    if (groupSize < 2) continue;
    const count = (lines || []).reduce((n, line) => {
      if (!offerCovers(offer, line.productId)) return n;
      return n + Math.max(0, Math.floor(Number(line.qty) || 0));
    }, 0);
    if (count < 1) continue;
    const remainder = count % groupSize;
    // Exact multiples already unlocked a discount (handled above)
    if (remainder === 0) continue;
    const need = groupSize - remainder;
    const label = offer.name || offerLabel(offer);
    return {
      kind: 'progress',
      message:
        need === 1
          ? `Add 1 more item for ${label}`
          : `Add ${need} more items for ${label}`,
      need,
      offer,
    };
  }
  return null;
}

/** Normalize offer lines from an order/quote for display on bills. */
export function offerLinesFromOrder(order) {
  const listed = Array.isArray(order?.appliedOffers) ? order.appliedOffers : [];
  const lines = listed
    .map((o) => ({
      offerId: o.offerId || o.id || o.name,
      name: o.name || offerLabel(o),
      discount: Number(o.discount) || 0,
    }))
    .filter((o) => o.discount > 0);
  const offerDiscount = Number(order?.offerDiscount) || 0;
  const listedTotal = round2(lines.reduce((n, o) => n + o.discount, 0));
  if (offerDiscount > 0.009 && listedTotal < offerDiscount - 0.009) {
    lines.push({
      offerId: 'offer-remainder',
      name: 'Offer',
      discount: round2(offerDiscount - listedTotal),
    });
  } else if (offerDiscount > 0.009 && !lines.length) {
    lines.push({ offerId: 'offer', name: 'Offer', discount: offerDiscount });
  }
  return lines;
}

export function couponDiscountFromOrder(order) {
  const total = Number(order?.discountAmount) || 0;
  const offers = Number(order?.offerDiscount) || 0;
  return round2(Math.max(0, total - offers));
}

const EMPTY = [];
const listeners = new Set();
let offers = EMPTY;
let pending = null;

const emit = () => listeners.forEach((fn) => fn());

export function loadActiveOffers({ force = false } = {}) {
  if (pending && !force) return pending;
  pending = api
    .get('/offers/active')
    .then(({ data }) => {
      offers = Array.isArray(data) ? data : EMPTY;
      emit();
      return offers;
    })
    .catch(() => offers)
    .finally(() => {
      pending = null;
    });
  return pending;
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getOffers = () => offers;

export function useActiveOffers() {
  useEffect(() => {
    loadActiveOffers();
  }, []);
  return useSyncExternalStore(subscribe, getOffers, getOffers);
}

/** Offer savings for the current bag lines ({ productId, price, qty }). */
export function useBagOffers(items) {
  const active = useActiveOffers();
  return applyOffers(items, active);
}
