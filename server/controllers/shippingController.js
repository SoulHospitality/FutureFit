const prisma = require('../lib/prisma');
const bosta = require('../utils/bosta');
const {
  keyOf,
  loadShippingSettings,
  saveShippingSettings,
  publicShippingConfig,
  serializeFreeOffer,
  bustFreeShipping,
  isLive,
} = require('../utils/shipping');

const fail = (res, err, fallback) =>
  res.status(err.status || 500).json({ message: err.message || fallback });

/** Storefront: open destinations with prices and any running free-shipping offer. */
const getShippingConfig = async (_req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    res.json(await publicShippingConfig());
  } catch (err) {
    fail(res, err, 'Could not load shipping');
  }
};

const cityId = (c) => String(c?._id || c?.id || c?.cityId || c?.cityID || '');
const cityEnglish = (c) => String(c?.name || c?.nameEn || c?.cityName || c?.alias || '').trim();
const cityArabic = (c) => String(c?.nameAr || c?.otherName || '').trim();

/**
 * Line our destinations up with Bosta's live governorate list. Each Bosta city
 * becomes one row (keeping our name and price when it matches one of ours);
 * our destinations Bosta doesn't have come back separately, since Bosta can't
 * ship there.
 */
const alignWithBosta = async (settings) => {
  if (!bosta.isConfigured()) {
    return { available: false, reason: 'Bosta is not connected (BOSTA_API_KEY is missing).' };
  }
  let cities;
  try {
    cities = await bosta.listCities();
  } catch (err) {
    return { available: false, reason: `Could not load Bosta's governorates: ${err.message}` };
  }
  if (!Array.isArray(cities) || !cities.length) {
    return { available: false, reason: 'Bosta returned no governorates.' };
  }

  const used = new Set();
  const matchFor = (city) => {
    const id = cityId(city);
    const names = bosta.catalogNames(city).map((n) => bosta.normalizeMatch(n));
    return settings.destinations.find((d) => {
      if (used.has(d.name)) return false;
      if (d.bostaCityId && id && String(d.bostaCityId) === id) return true;
      const aliases = bosta.governorateAliasSet(d.name);
      return names.some((n) => aliases.has(n)) || names.includes(bosta.normalizeMatch(d.name));
    });
  };

  const order = new Map(settings.destinations.map((d, i) => [d.name, i]));
  const rows = cities
    .filter((c) => cityId(c) && cityEnglish(c))
    .map((city) => {
      const dest = matchFor(city);
      if (dest) used.add(dest.name);
      const delivers = city.dropOffAvailability !== false;
      return {
        name: dest?.name || cityEnglish(city),
        fee: dest ? Number(dest.fee) : Number(settings.defaultFee),
        enabled: delivers ? (dest ? dest.enabled !== false : true) : false,
        bostaCityId: cityId(city),
        bostaName: cityEnglish(city),
        bostaNameAr: cityArabic(city),
        status: !delivers ? 'no_dropoff' : dest ? 'matched' : 'new',
      };
    })
    .sort((a, b) => (order.get(a.name) ?? 999) - (order.get(b.name) ?? 999) || a.name.localeCompare(b.name));

  const notOnBosta = settings.destinations
    .filter((d) => !used.has(d.name))
    .map((d) => ({ ...d, enabled: false, status: 'not_on_bosta' }));

  return { available: true, rows, notOnBosta, count: rows.length };
};

/** Staff: saved prices, lined up with Bosta's governorates. */
const getShippingAdmin = async (_req, res) => {
  try {
    const settings = await loadShippingSettings();
    const bostaView = await alignWithBosta(settings);
    res.set('Cache-Control', 'no-store');
    res.json({ settings, bosta: bostaView });
  } catch (err) {
    fail(res, err, 'Could not load shipping settings');
  }
};

const updateShippingAdmin = async (req, res) => {
  try {
    const saved = await saveShippingSettings({
      ...req.body,
      bostaSyncedAt: req.body?.alignedWithBosta ? new Date().toISOString() : req.body?.bostaSyncedAt,
    });
    res.json({ settings: saved });
  } catch (err) {
    fail(res, err, 'Could not save shipping prices');
  }
};

/* ---------- Free shipping offers ---------- */

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

const parseDate = (value, label, { required = false } = {}) => {
  if (value === '' || value == null) {
    if (required) throw badRequest(`${label} is required`);
    return null;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw badRequest(`${label} isn't a valid date`);
  return d;
};

const parseFreeOffer = (body = {}, existing = null) => {
  const pick = (key) => (body[key] !== undefined ? body[key] : existing?.[key]);
  const name = String(pick('name') || '').trim().slice(0, 80) || 'Free shipping';
  const min = Number(pick('minSubtotal'));
  if (!Number.isFinite(min) || min < 0 || min > 1_000_000) {
    throw badRequest('Enter the order total that unlocks free shipping (0 or more EGP)');
  }
  const startsAt = parseDate(pick('startsAt'), 'Start date', { required: true });
  const endsAt = parseDate(pick('endsAt'), 'End date');
  if (endsAt && endsAt <= startsAt) throw badRequest('The end date must be after the start date');
  return {
    name,
    minSubtotal: Math.round(min * 100) / 100,
    startsAt,
    endsAt,
    showAnnouncement: pick('showAnnouncement') !== false,
    announcementText: String(pick('announcementText') || '').trim().slice(0, 140) || null,
    isActive: pick('isActive') !== false,
  };
};

const withState = (o) => {
  const s = serializeFreeOffer(o);
  const now = new Date();
  let state = 'live';
  if (!o.isActive) state = 'off';
  else if (new Date(o.startsAt) > now) state = 'scheduled';
  else if (o.endsAt && new Date(o.endsAt) <= now) state = 'ended';
  return { ...s, state, live: isLive(o, now) };
};

const listFreeOffers = async (_req, res) => {
  try {
    const rows = await prisma.freeShippingOffer.findMany({ orderBy: [{ startsAt: 'desc' }] });
    res.json(rows.map(withState));
  } catch (err) {
    fail(res, err, 'Could not load free shipping offers');
  }
};

const createFreeOffer = async (req, res) => {
  try {
    const row = await prisma.freeShippingOffer.create({ data: parseFreeOffer(req.body) });
    bustFreeShipping();
    res.status(201).json(withState(row));
  } catch (err) {
    fail(res, err, 'Could not create the offer');
  }
};

const updateFreeOffer = async (req, res) => {
  try {
    const existing = await prisma.freeShippingOffer.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Offer not found' });
    const row = await prisma.freeShippingOffer.update({
      where: { id: existing.id },
      data: parseFreeOffer(req.body, { ...existing, minSubtotal: Number(existing.minSubtotal) }),
    });
    bustFreeShipping();
    res.json(withState(row));
  } catch (err) {
    fail(res, err, 'Could not update the offer');
  }
};

const deleteFreeOffer = async (req, res) => {
  try {
    await prisma.freeShippingOffer.delete({ where: { id: req.params.id } });
    bustFreeShipping();
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Offer not found' });
    fail(res, err, 'Could not delete the offer');
  }
};

module.exports = {
  getShippingConfig,
  getShippingAdmin,
  updateShippingAdmin,
  listFreeOffers,
  createFreeOffer,
  updateFreeOffer,
  deleteFreeOffer,
  alignWithBosta,
  keyOf,
};
