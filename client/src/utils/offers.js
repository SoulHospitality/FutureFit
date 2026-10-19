import { useEffect, useSyncExternalStore } from 'react';
import api from '../api/axios';

/** Automatic Buy X Get 1 offers set from Staff → Promotions. Checkout totals come from the server quote. */

export const OFFER_TYPES = {
  buy1get1_free: { buy: 1, pct: 100, label: 'Buy 1 Get 1 Free', hint: 'Add 2 — the cheaper one is free' },
  buy2get1_free: { buy: 2, pct: 100, label: 'Buy 2 Get 1 Free', hint: 'Add 3 — the cheapest one is free' },
  buy1get1_half: { buy: 1, pct: 50, label: 'Buy 1 Get 1 50% Off', hint: 'Add 2 — the cheaper one is half price' },
  buy2get1_half: { buy: 2, pct: 50, label: 'Buy 2 Get 1 50% Off', hint: 'Add 3 — the cheapest one is half price' },
};

export const OFFER_TYPE_KEYS = Object.keys(OFFER_TYPES);

const generosity = (type) => {
  const t = OFFER_TYPES[type];
  return t ? t.pct / (t.buy + 1) : 0;
};

const round2 = (n) => Math.round(n * 100) / 100;

export const offerCovers = (offer, productId) => {
  if (!offer || offer.isActive === false) return false;
  if (offer.appliesTo !== 'selected') return true;
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
}

/** Best offer shown on a product (most generous first). */
export function offerForProduct(offers, productId) {
  if (!productId) return null;
  return (
    [...(offers || [])]
      .filter((o) => OFFER_TYPES[o.type] && offerCovers(o, productId))
      .sort((a, b) => generosity(b.type) - generosity(a.type))[0] || null
  );
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

  const sorted = [...(offers || [])]
    .filter((o) => o && o.isActive !== false && OFFER_TYPES[o.type])
    .sort((a, b) => generosity(b.type) - generosity(a.type));

  for (const offer of sorted) {
    const { buy } = OFFER_TYPES[offer.type];
    const groupSize = buy + 1;
    const count = (lines || []).reduce((n, line) => {
      if (!offerCovers(offer, line.productId)) return n;
      return n + Math.max(0, Math.floor(Number(line.qty) || 0));
    }, 0);
    if (count < 1) continue;
    const remainder = count % groupSize;
    // Exact multiples already unlocked a discount (handled above)
    if (remainder === 0) continue;
    const need = groupSize - remainder;
    const label = offer.name || OFFER_TYPES[offer.type].label;
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
      name: o.name || OFFER_TYPES[o.type]?.label || 'Offer',
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
