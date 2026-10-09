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

export const offerCovers = (offer, productId) =>
  offer.appliesTo === 'all' || (offer.productIds || []).includes(productId);

/** Mirrors server/utils/offers.js so the bag can show savings before checkout. */
export function applyOffers(lines, offers) {
  const units = [];
  for (const line of lines || []) {
    const qty = Math.max(0, Math.floor(Number(line.qty) || 0));
    for (let i = 0; i < qty; i += 1) {
      units.push({ productId: line.productId, price: Number(line.price) || 0, used: false });
    }
  }

  const sorted = [...(offers || [])]
    .filter((o) => OFFER_TYPES[o.type])
    .sort((a, b) => generosity(b.type) - generosity(a.type));

  const applied = [];
  let total = 0;
  for (const offer of sorted) {
    const { buy, pct } = OFFER_TYPES[offer.type];
    const groupSize = buy + 1;
    const eligible = units
      .filter((u) => !u.used && offerCovers(offer, u.productId))
      .sort((a, b) => b.price - a.price);
    const groups = Math.floor(eligible.length / groupSize);
    if (!groups) continue;
    let discount = 0;
    for (let g = 0; g < groups; g += 1) {
      const group = eligible.slice(g * groupSize, (g + 1) * groupSize);
      group.forEach((u) => { u.used = true; });
      discount += (group[group.length - 1].price * pct) / 100;
    }
    discount = round2(discount);
    if (discount <= 0) continue;
    total += discount;
    applied.push({ offerId: offer.id, name: offer.name || OFFER_TYPES[offer.type].label, discount });
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
    .catch(() => offers);
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
