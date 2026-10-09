const prisma = require('../lib/prisma');
const { OFFER_TYPES, getActiveOffers, invalidateOffers } = require('../utils/offers');

const parseOffer = (body, { partial = false } = {}) => {
  const data = {};
  if (body.type !== undefined || !partial) {
    if (!OFFER_TYPES[body.type]) {
      const err = new Error('Choose an offer type');
      err.status = 400;
      throw err;
    }
    data.type = body.type;
  }
  if (body.name !== undefined || !partial) {
    const name = String(body.name || '').trim().slice(0, 80);
    data.name = name || OFFER_TYPES[data.type || body.type]?.label || 'Offer';
  }
  if (body.appliesTo !== undefined || !partial) {
    data.appliesTo = body.appliesTo === 'selected' ? 'selected' : 'all';
  }
  if (body.productIds !== undefined || !partial) {
    data.productIds = Array.isArray(body.productIds)
      ? [...new Set(body.productIds.map(String).filter(Boolean))].slice(0, 2000)
      : [];
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (data.appliesTo === 'selected' && data.productIds && !data.productIds.length) {
    const err = new Error('Pick at least one product, or apply the offer to all items');
    err.status = 400;
    throw err;
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
    res.json(offers.map(({ id, name, type, appliesTo, productIds }) => ({
      id,
      name,
      type,
      appliesTo,
      productIds: appliesTo === 'selected' ? productIds : [],
    })));
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
    const offer = await prisma.offer.update({
      where: { id: req.params.id },
      data: parseOffer(req.body, { partial: true }),
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
