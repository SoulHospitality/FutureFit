import { useEffect, useSyncExternalStore } from 'react';
import api from '../api/axios';

/**
 * Shipping prices per destination (Staff → Shipping, aligned with Bosta) and the
 * running free-shipping offer (Staff → Promotions). Checkout totals come from
 * the server quote; this is for showing prices before that.
 */

const FALLBACK_DESTINATIONS = [
  ['Cairo', 85], ['Giza', 85], ['Alexandria', 110], ['Dakahlia', 110], ['Red Sea', 180],
  ['Beheira', 110], ['Fayoum', 145], ['Gharbia', 110], ['Ismailia', 110], ['Menofia', 110],
  ['Minya', 145], ['Qalyubia', 110], ['New Valley', 180], ['Suez', 110], ['Aswan', 180],
  ['Assiut', 145], ['Beni Suef', 145], ['Port Said', 110], ['Damietta', 110], ['Sharqia', 110],
  ['South Sinai', 180], ['Kafr El Sheikh', 110], ['Matrouh', 180], ['Luxor', 180], ['Qena', 180],
  ['North Sinai', 180], ['Sohag', 145],
].map(([name, fee]) => ({ name, fee, nameAr: '' }));

const FALLBACK = {
  loaded: false,
  defaultFee: 180,
  destinations: FALLBACK_DESTINATIONS,
  freeShipping: null,
};

const keyOf = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]/g, '');

let config = FALLBACK;
let pending = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function loadShippingConfig({ force = false } = {}) {
  if (pending && !force) return pending;
  if (config.loaded && !force) return Promise.resolve(config);
  pending = api
    .get('/shipping/config')
    .then(({ data }) => {
      if (data && Array.isArray(data.destinations) && data.destinations.length) {
        config = {
          loaded: true,
          defaultFee: Number(data.defaultFee) || FALLBACK.defaultFee,
          destinations: data.destinations,
          freeShipping: data.freeShipping || null,
        };
        emit();
      }
      return config;
    })
    .catch(() => config)
    .finally(() => {
      pending = null;
    });
  return pending;
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getConfig = () => config;

export function useShippingConfig() {
  useEffect(() => {
    loadShippingConfig();
  }, []);
  return useSyncExternalStore(subscribe, getConfig, getConfig);
}

/** Governorate names customers can pick at checkout. */
export const destinationNames = (cfg) => (cfg?.destinations || []).map((d) => d.name);

export const isDestination = (cfg, state) => {
  const key = keyOf(state);
  return Boolean(key) && (cfg?.destinations || []).some((d) => keyOf(d.name) === key);
};

/** Delivery price for a governorate (no free shipping applied); null when none chosen. */
export function shippingFeeFor(cfg, state) {
  if (!String(state || '').trim()) return null;
  const key = keyOf(state);
  const hit = (cfg?.destinations || []).find((d) => keyOf(d.name) === key);
  return Number(hit ? hit.fee : cfg?.defaultFee ?? FALLBACK.defaultFee);
}

/**
 * Shipping for a bag. `itemsAfterDiscounts` is what the customer pays for the
 * items. Returns 0 when free shipping applies, null when no governorate is set.
 */
export function calcShipping(cfg, itemsAfterDiscounts, state) {
  const items = Number(itemsAfterDiscounts) || 0;
  if (items <= 0) return 0;
  const free = cfg?.freeShipping;
  if (free && items >= Number(free.minSubtotal)) return 0;
  return shippingFeeFor(cfg, state);
}

/** Progress toward the running free-shipping offer, or null when there is none. */
export function freeShippingProgress(cfg, itemsAfterDiscounts) {
  const free = cfg?.freeShipping;
  if (!free) return null;
  const threshold = Number(free.minSubtotal) || 0;
  const amount = Math.max(0, Number(itemsAfterDiscounts) || 0);
  const remaining = Math.max(0, threshold - amount);
  return {
    threshold,
    remaining,
    unlocked: remaining <= 0,
    progress: threshold > 0 ? Math.min(100, (amount / threshold) * 100) : 100,
    endsAt: free.endsAt || null,
  };
}
