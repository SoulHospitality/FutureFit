/**
 * Shipping prices per destination (set in Staff → Shipping, aligned with
 * Bosta's governorate list) and free-shipping offers (Staff → Promotions).
 */
const prisma = require('../lib/prisma');
const cache = require('../lib/cache');

const SETTINGS_KEY = 'shipping';
const SETTINGS_CACHE = 'shipping-settings';
const FREE_CACHE = 'shipping-free';
const MAX_FEE = 10000;

/** Starting prices (EGP) before staff set their own. */
const DEFAULT_DESTINATIONS = [
  ['Cairo', 85],
  ['Giza', 85],
  ['Alexandria', 110],
  ['Dakahlia', 110],
  ['Red Sea', 180],
  ['Beheira', 110],
  ['Fayoum', 145],
  ['Gharbia', 110],
  ['Ismailia', 110],
  ['Menofia', 110],
  ['Minya', 145],
  ['Qalyubia', 110],
  ['New Valley', 180],
  ['Suez', 110],
  ['Aswan', 180],
  ['Assiut', 145],
  ['Beni Suef', 145],
  ['Port Said', 110],
  ['Damietta', 110],
  ['Sharqia', 110],
  ['South Sinai', 180],
  ['Kafr El Sheikh', 110],
  ['Matrouh', 180],
  ['Luxor', 180],
  ['Qena', 180],
  ['North Sinai', 180],
  ['Sohag', 145],
];
const DEFAULT_FEE = 180;

const round2 = (n) => Math.round(n * 100) / 100;

const keyOf = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]/g, '');

const defaults = () => ({
  defaultFee: DEFAULT_FEE,
  destinations: DEFAULT_DESTINATIONS.map(([name, fee]) => ({
    name,
    fee,
    enabled: true,
    bostaCityId: null,
    bostaName: null,
    bostaNameAr: null,
  })),
  bostaSyncedAt: null,
});

const badRequest = (message) => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

const cleanFee = (value, label) => {
  const n = Number(value);
  if (value === '' || value == null || !Number.isFinite(n) || n < 0 || n > MAX_FEE) {
    throw badRequest(`${label}: enter a price between 0 and ${MAX_FEE} EGP`);
  }
  return round2(n);
};

const loadShippingSettings = async () => {
  const { data } = await cache.wrap(SETTINGS_CACHE, 60_000, async () => {
    const row = await prisma.storeSetting.findUnique({ where: { key: SETTINGS_KEY } });
    const saved = row?.value && typeof row.value === 'object' ? row.value : null;
    if (!saved || !Array.isArray(saved.destinations) || !saved.destinations.length) return defaults();
    return { ...defaults(), ...saved };
  });
  return data;
};

const saveShippingSettings = async (body = {}) => {
  const list = Array.isArray(body.destinations) ? body.destinations : [];
  if (!list.length) throw badRequest('Add at least one destination');
  const seen = new Set();
  const destinations = list.map((d, i) => {
    const name = String(d?.name || '').trim().slice(0, 80);
    if (!name) throw badRequest(`Destination ${i + 1} needs a name`);
    const key = keyOf(name);
    if (seen.has(key)) throw badRequest(`${name} is listed twice`);
    seen.add(key);
    return {
      name,
      fee: cleanFee(d.fee, name),
      enabled: d.enabled !== false,
      bostaCityId: d.bostaCityId ? String(d.bostaCityId).slice(0, 64) : null,
      bostaName: d.bostaName ? String(d.bostaName).slice(0, 80) : null,
      bostaNameAr: d.bostaNameAr ? String(d.bostaNameAr).slice(0, 80) : null,
    };
  });
  if (!destinations.some((d) => d.enabled)) throw badRequest('Keep at least one destination open');
  const value = {
    defaultFee: cleanFee(body.defaultFee ?? DEFAULT_FEE, 'Other destinations'),
    destinations,
    bostaSyncedAt: body.bostaSyncedAt || null,
  };
  await prisma.storeSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value },
    create: { key: SETTINGS_KEY, value },
  });
  cache.invalidate(SETTINGS_CACHE);
  return value;
};

/** Destination for a governorate name, or null when it isn't listed. */
const findDestination = (settings, state) => {
  const key = keyOf(state);
  if (!key) return null;
  return (
    settings.destinations.find(
      (d) => keyOf(d.name) === key || keyOf(d.bostaName) === key || keyOf(d.bostaNameAr) === key
    ) || null
  );
};

/* ---------- Free shipping offers ---------- */

const isLive = (offer, now = new Date()) =>
  offer.isActive &&
  new Date(offer.startsAt) <= now &&
  (!offer.endsAt || new Date(offer.endsAt) > now);

const serializeFreeOffer = (o) => ({
  id: o.id,
  name: o.name,
  minSubtotal: Number(o.minSubtotal),
  startsAt: o.startsAt,
  endsAt: o.endsAt,
  showAnnouncement: o.showAnnouncement,
  announcementText: o.announcementText || '',
  isActive: o.isActive,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
});

const announcementFor = (offer) => {
  if (!offer?.showAnnouncement) return null;
  const custom = String(offer.announcementText || '').trim();
  if (custom) return custom;
  const amount = new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(offer.minSubtotal);
  return `Free shipping on orders over EGP ${amount}`;
};

/** The free-shipping offer running now (lowest threshold wins), or null. */
const getActiveFreeShipping = async () => {
  const { data } = await cache.wrap(FREE_CACHE, 30_000, async () => {
    const now = new Date();
    const rows = await prisma.freeShippingOffer.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { minSubtotal: 'asc' },
      take: 1,
    });
    return rows[0] ? serializeFreeOffer(rows[0]) : null;
  });
  // Cached up to 30s: re-check the window so an offer stops right on time
  return data && isLive(data) ? data : null;
};

const bustFreeShipping = () => cache.invalidate(FREE_CACHE);

/**
 * Shipping for an order. `itemsAfterDiscounts` is what the customer pays for
 * the items (after offers and promo codes) — the free-shipping threshold uses it.
 * Returns { fee, free, freeOffer, destination }; fee is null when no governorate
 * is chosen yet. Throws 400 when delivery to that governorate is switched off.
 */
const quoteShipping = async (itemsAfterDiscounts, state) => {
  const [settings, freeOffer] = await Promise.all([loadShippingSettings(), getActiveFreeShipping()]);
  const items = Number(itemsAfterDiscounts) || 0;
  if (!String(state || '').trim()) return { fee: null, free: false, freeOffer, destination: null };
  const destination = findDestination(settings, state);
  if (destination && destination.enabled === false) {
    throw badRequest(`Delivery to ${destination.name} isn't available right now`);
  }
  if (items <= 0) return { fee: 0, free: false, freeOffer, destination };
  if (freeOffer && items >= freeOffer.minSubtotal) {
    return { fee: 0, free: true, freeOffer, destination };
  }
  const fee = destination ? Number(destination.fee) : Number(settings.defaultFee);
  return { fee: round2(fee), free: false, freeOffer, destination };
};

/** What the storefront needs: open destinations with prices, and the free-shipping offer. */
const publicShippingConfig = async () => {
  const [settings, freeOffer] = await Promise.all([loadShippingSettings(), getActiveFreeShipping()]);
  return {
    defaultFee: Number(settings.defaultFee),
    destinations: settings.destinations
      .filter((d) => d.enabled !== false)
      .map((d) => ({ name: d.name, fee: Number(d.fee), nameAr: d.bostaNameAr || '' })),
    freeShipping: freeOffer
      ? {
          id: freeOffer.id,
          name: freeOffer.name,
          minSubtotal: freeOffer.minSubtotal,
          startsAt: freeOffer.startsAt,
          endsAt: freeOffer.endsAt,
          announcement: announcementFor(freeOffer),
        }
      : null,
  };
};

module.exports = {
  DEFAULT_DESTINATIONS,
  DEFAULT_FEE,
  keyOf,
  loadShippingSettings,
  saveShippingSettings,
  findDestination,
  quoteShipping,
  publicShippingConfig,
  getActiveFreeShipping,
  serializeFreeOffer,
  bustFreeShipping,
  isLive,
};
