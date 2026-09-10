const prisma = require('../lib/prisma');

const serialize = (row) => ({
  ...row,
  subtotal: Number(row.subtotal),
  cartItems: Array.isArray(row.cartItems) ? row.cartItems : [],
  shippingAddress: row.shippingAddress || null,
});

/** Public upsert from checkout — creates/updates abandoned draft. */
const upsertAbandoned = async (req, res) => {
  try {
    const {
      sessionKey,
      guestName,
      guestPhone,
      guestEmail,
      shippingAddress,
      cartItems,
      subtotal,
      lastStep,
    } = req.body || {};

    const key = String(sessionKey || '').trim();
    if (!key) return res.status(400).json({ message: 'sessionKey required' });

    const items = Array.isArray(cartItems) ? cartItems : [];
    if (!items.length) {
      // Empty cart → remove draft if present
      await prisma.abandonedCheckout.deleteMany({ where: { sessionKey: key } });
      return res.json({ cleared: true });
    }

    const userId = req.user?.id || null;
    const data = {
      userId,
      guestName: guestName ? String(guestName).trim() : null,
      guestPhone: guestPhone ? String(guestPhone).replace(/\s+/g, '').trim() : null,
      guestEmail: guestEmail ? String(guestEmail).trim().toLowerCase() : null,
      shippingAddress: shippingAddress || null,
      cartItems: items.slice(0, 40).map((i) => ({
        productId: i.productId,
        name: i.name,
        qty: Number(i.qty) || 1,
        price: Number(i.price) || 0,
        image: i.image || '',
        color: i.color || null,
        size: i.size || null,
      })),
      subtotal: Math.max(0, Number(subtotal) || 0),
      lastStep: lastStep || 'contact',
      recoveryStatus: 'not_recovered',
      completedOrderId: null,
      completedAt: null,
    };

    const row = await prisma.abandonedCheckout.upsert({
      where: { sessionKey: key },
      create: { sessionKey: key, ...data },
      update: data,
    });

    res.json(serialize(row));
  } catch (err) {
    console.error('upsertAbandoned:', err);
    res.status(500).json({ message: err.message });
  }
};

/** Mark abandoned checkout completed after successful order. */
const completeAbandoned = async (req, res) => {
  try {
    const key = String(req.body?.sessionKey || '').trim();
    const orderId = req.body?.orderId ? String(req.body.orderId) : null;
    if (!key) return res.status(400).json({ message: 'sessionKey required' });

    const existing = await prisma.abandonedCheckout.findUnique({ where: { sessionKey: key } });
    if (!existing) return res.json({ ok: true, missing: true });

    const row = await prisma.abandonedCheckout.update({
      where: { sessionKey: key },
      data: {
        recoveryStatus: 'completed',
        completedOrderId: orderId,
        completedAt: new Date(),
      },
    });
    res.json(serialize(row));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listAbandoned = async (req, res) => {
  try {
    const status = req.query.status || 'not_recovered';
    const where =
      status === 'all'
        ? {}
        : status === 'incomplete'
          ? { recoveryStatus: { in: ['not_recovered', 'recovered'] } }
          : { recoveryStatus: status };

    const rows = await prisma.abandonedCheckout.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    res.json(rows.map(serialize));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const markRecovered = async (req, res) => {
  try {
    const row = await prisma.abandonedCheckout.update({
      where: { id: req.params.id },
      data: { recoveryStatus: 'recovered' },
    });
    res.json(serialize(row));
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Not found' });
    res.status(500).json({ message: err.message });
  }
};

const deleteAbandoned = async (req, res) => {
  try {
    await prisma.abandonedCheckout.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted', id: req.params.id });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Not found' });
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  upsertAbandoned,
  completeAbandoned,
  listAbandoned,
  markRecovered,
  deleteAbandoned,
};
