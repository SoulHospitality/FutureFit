const prisma = require('../lib/prisma');
const paymob = require('../utils/paymob');

const PAYMOB_METHOD = 'Paymob';

const startPaymobForOrder = async (order) => {
  const addr = order.shippingAddress || {};
  const fullName = order.user?.name || order.guestName || 'Customer';
  const [firstName, ...rest] = String(fullName).trim().split(/\s+/);
  const lastName = rest.join(' ') || 'FutureFit';
  const phone = order.user?.phone || order.guestPhone || '01000000000';
  const email = order.user?.email || order.guestEmail || 'orders@futurefit.eg';

  const intention = await paymob.createIntention({
    orderId: order.id,
    amountEgp: Number(order.totalPrice),
    items: (order.items || []).map((i) => ({
      name: i.name,
      price: Number(i.price),
      qty: i.qty,
    })),
    customer: { firstName, lastName, phone, email },
    billing: {
      firstName,
      lastName,
      phone,
      email,
      street: addr.street,
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
      country: addr.country,
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { paymobIntentionId: intention.intentionId ? String(intention.intentionId) : null },
  });

  return intention;
};

/** Transaction processed webhook from Paymob */
const handleWebhook = async (req, res) => {
  try {
    const hmac = req.query.hmac;
    const obj = req.body?.obj || req.body?.transaction || req.body;
    if (!obj || typeof obj !== 'object') {
      return res.status(400).json({ message: 'Invalid payload' });
    }

    if (!paymob.verifyTransactionHmac(obj, hmac)) {
      console.warn('Paymob webhook HMAC mismatch');
      return res.status(401).json({ message: 'Invalid HMAC' });
    }

    const success = obj.success === true || obj.success === 'true';
    const pending = obj.pending === true || obj.pending === 'true';
    const transactionId = obj.id != null ? String(obj.id) : null;

    const candidates = [
      obj.special_reference,
      obj.merchant_order_id,
      obj.order?.merchant_order_id,
      obj.order?.shipping_data?.order_id,
      obj.payment_key_claims?.extra?.merchant_order_id,
      obj.payment_key_claims?.extra?.special_reference,
      obj.payment_key_claims?.extras?.merchant_order_id,
      obj.payment_key_claims?.extras?.special_reference,
      obj.intention?.extras?.merchant_order_id,
      obj.intention?.special_reference,
      typeof obj.payment_key_claims?.order_id === 'string' &&
      obj.payment_key_claims.order_id.length > 20
        ? obj.payment_key_claims.order_id
        : null,
    ]
      .map((v) => (v != null ? String(v) : ''))
      .filter(Boolean);

    let order = null;
    for (const id of candidates) {
      order = await prisma.order.findUnique({ where: { id } });
      if (order) break;
    }

    if (!order && obj.order?.id != null) {
      // Intention id sometimes stored; try match on paymobIntentionId
      order = await prisma.order.findFirst({
        where: { paymobIntentionId: String(obj.order.id) },
      });
    }

    if (!order) {
      console.warn('Paymob webhook: could not resolve FutureFit order id', {
        transactionId,
        candidates,
      });
      return res.status(200).json({ received: true, matched: false });
    }

    const orderId = order.id;
    const existing = order;

    if (transactionId && existing.paymobTransactionId === transactionId && existing.isPaid) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    if (success && !pending) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          isPaid: true,
          paidAt: existing.paidAt || new Date(),
          paymobTransactionId: transactionId,
          status: existing.status === 'pending' ? 'confirmed' : existing.status,
          paymentMethod: existing.paymentMethod || PAYMOB_METHOD,
        },
      });
      // After successful card/wallet payment → confirm + auto-sync Bosta
      const { fulfillOrderWithBosta } = require('./bostaController');
      await fulfillOrderWithBosta(orderId, { confirm: true });
    } else if (transactionId && !existing.paymobTransactionId) {
      await prisma.order.update({
        where: { id: orderId },
        data: { paymobTransactionId: transactionId },
      });
    }

    return res.status(200).json({ received: true, matched: true, success });
  } catch (err) {
    console.error('Paymob webhook error:', err);
    return res.status(200).json({ received: true, error: true });
  }
};

const paymentConfig = async (_req, res) => {
  res.json({
    paymobEnabled: paymob.isConfigured(),
    bostaEnabled: require('../utils/bosta').isConfigured(),
  });
};

module.exports = {
  PAYMOB_METHOD,
  startPaymobForOrder,
  handleWebhook,
  paymentConfig,
};
