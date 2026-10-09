const prisma = require('../lib/prisma');

/** Orders that count toward a code's limit — canceled orders give the use back. */
const couponUseCount = (couponId, db = prisma) =>
  db.order.count({ where: { couponId, status: { not: 'canceled' } } });

const parseMaxUses = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const withUsage = async (coupons) => {
  const counts = await Promise.all(coupons.map((c) => couponUseCount(c.id)));
  return coupons.map((c, i) => ({ ...c, usedCount: counts[i] }));
};

const listCoupons = async (req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(await withUsage(coupons));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const parsePercentage = (value) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1 || n > 100) {
    const err = new Error('Discount must be between 1 and 100%');
    err.status = 400;
    throw err;
  }
  return n;
};

const createCoupon = async (req, res) => {
  try {
    const { code, discountPercentage, isActive } = req.body;
    if (!code || discountPercentage == null) {
      return res.status(400).json({ message: 'Code and discountPercentage required' });
    }
    const coupon = await prisma.coupon.create({
      data: {
        code: String(code).trim().toUpperCase(),
        discountPercentage: parsePercentage(discountPercentage),
        isActive: isActive !== false,
        maxUses: parseMaxUses(req.body.maxUses) ?? null,
      },
    });
    res.status(201).json({ ...coupon, usedCount: 0 });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.code === 'P2002') return res.status(400).json({ message: 'That code already exists' });
    res.status(500).json({ message: error.message });
  }
};

const updateCoupon = async (req, res) => {
  try {
    const data = {};
    if (req.body.code !== undefined) data.code = String(req.body.code).trim().toUpperCase();
    if (req.body.discountPercentage !== undefined) {
      data.discountPercentage = parsePercentage(req.body.discountPercentage);
    }
    if (req.body.isActive !== undefined) data.isActive = Boolean(req.body.isActive);
    const maxUses = parseMaxUses(req.body.maxUses);
    if (maxUses !== undefined) data.maxUses = maxUses;
    const coupon = await prisma.coupon.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ ...coupon, usedCount: await couponUseCount(coupon.id) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.code === 'P2002') return res.status(400).json({ message: 'That code already exists' });
    res.status(500).json({ message: error.message });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    await prisma.$transaction([
      prisma.order.updateMany({ where: { couponId: req.params.id }, data: { couponId: null } }),
      prisma.coupon.delete({ where: { id: req.params.id } }),
    ]);
    res.json({ message: 'Coupon deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** Throws a 400 when the code is unknown, off, or used up. */
const findUsableCoupon = async (rawCode, db = prisma) => {
  const code = String(rawCode || '').trim().toUpperCase();
  const coupon = code ? await db.coupon.findUnique({ where: { code } }) : null;
  if (!coupon || !coupon.isActive) {
    const err = new Error('Invalid promo code');
    err.status = 400;
    throw err;
  }
  if (coupon.maxUses != null && (await couponUseCount(coupon.id, db)) >= coupon.maxUses) {
    const err = new Error('This promo code has reached its usage limit');
    err.status = 400;
    throw err;
  }
  return coupon;
};

const validateCoupon = async (req, res) => {
  try {
    const coupon = await findUsableCoupon(req.body.code || req.query.code);
    res.json({ code: coupon.code, discountPercentage: coupon.discountPercentage });
  } catch (error) {
    if (error.status) return res.status(404).json({ message: error.message });
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  findUsableCoupon,
  couponUseCount,
};
