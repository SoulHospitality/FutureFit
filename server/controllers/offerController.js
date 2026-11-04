const prisma = require('../lib/prisma');
const {
  OFFER_TYPES,
  OFFER_SCOPES,
  MIN_PERCENT,
  MAX_PERCENT,
  offerLabel,
  getActiveOffers,
  invalidateOffers,
} = require('../utils/offers');

const badRequest = (message) => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

const cleanIds = (ids) =>
  Array.isArray(ids) ? [...new Set(ids.map(String).filter(Boolean))].slice(0, 2000) : [];

/**
 * Validate a create/update body. On partial updates the existing row is merged in
 * so cross-field rules (percentage, scope lists) are checked against the result.
 */
const parseOffer = (body, { existing = null } = {}) => {
  const partial = Boolean(existing);
  const data = {};
  if (body.type !== undefined || !partial) {
    if (!OFFER_TYPES[body.type]) throw badRequest('Choose an offer type');
    data.type = body.type;
  }
  const type = data.type || existing?.type;

  if (type === 'percent_off') {
    const raw = Number(body.percentage !== undefined ? body.percentage : existing?.percentage);
    if (!Number.isFinite(raw) || raw < MIN_PERCENT || raw > MAX_PERCENT) {
      throw badRequest(`Enter a discount between ${MIN_PERCENT}% and ${MAX_PERCENT}%`);
    }
    data.percentage = Math.round(raw);
  } else if (!partial || data.type) {
    data.percentage = null;
  }

  if (body.name !== undefined || !partial) {
    const name = String(body.name || '').trim().slice(0, 80);
    data.name =
      name ||
      offerLabel({ type, percentage: data.percentage ?? existing?.percentage }) ||
      'Offer';
  }
  if (body.appliesTo !== undefined || !partial) {
    data.appliesTo = OFFER_SCOPES.includes(body.appliesTo) ? body.appliesTo : 'all';
  }
  if (body.productIds !== undefined || !partial) data.productIds = cleanIds(body.productIds);
  if (body.categoryIds !== undefined || !partial) data.categoryIds = cleanIds(body.categoryIds);
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const scope = data.appliesTo || existing?.appliesTo || 'all';
  const productIds = data.productIds ?? existing?.productIds ?? [];
  const categoryIds = data.categoryIds ?? existing?.categoryIds ?? [];
  if (scope === 'selected' && !productIds.length) {
    throw badRequest('Pick at least one product, or apply the offer to all items');
  }
  if (scope === 'category' && !categoryIds.length) throw badRequest('Pick at least one category');
  if (scope === 'subcategory' && !categoryIds.length) {
    throw badRequest('Pick at least one subcategory');
  }
  return data;
};

const usageByOffer = async (offers) => {
  const counts = await Promise.all(
    offers.map((o) =>
      prisma.order.count({
        where: {
          status: { not: 'canceled' },
          appliedOffers: { array_contains: [{ offerId: o.id }] },
        },
      })
    )
  );
  return Object.fromEntries(offers.map((o, i) => [o.id, counts[i]]));
};

const listOffers = async (req, res) => {
  try {
    const offers = await prisma.offer.findMany({ orderBy: { createdAt: 'desc' } });
    const usage = await usageByOffer(offers);
    res.json(offers.map((o) => ({ ...o, orderCount: usage[o.id] || 0 })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const publicOffers = async (req, res) => {
  try {
    const offers = await getActiveOffers();
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    res.json(
      // Category scopes arrive already expanded into productIds
      offers.map(({ id, name, type, percentage, appliesTo, productIds, isActive }) => ({
        id,
        name,
        type,
        ...(type === 'percent_off' ? { percentage } : {}),
        appliesTo: appliesTo || 'all',
        productIds: appliesTo && appliesTo !== 'all' ? productIds || [] : [],
        isActive: isActive !== false,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createOffer = async (req, res) => {
  try {
    const offer = await prisma.offer.create({ data: parseOffer(req.body) });
    invalidateOffers();
    res.status(201).json({ ...offer, orderCount: 0 });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    res.status(500).json({ message: error.message });
  }
};

const updateOffer = async (req, res) => {
  try {
    const existing = await prisma.offer.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Offer not found' });
    const offer = await prisma.offer.update({
      where: { id: req.params.id },
      data: parseOffer(req.body, { existing }),
    });
    invalidateOffers();
    res.json(offer);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    res.status(500).json({ message: error.message });
  }
};

const deleteOffer = async (req, res) => {
  try {
    await prisma.offer.delete({ where: { id: req.params.id } });
    invalidateOffers();
    res.json({ message: 'Offer deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { listOffers, publicOffers, createOffer, updateOffer, deleteOffer };
