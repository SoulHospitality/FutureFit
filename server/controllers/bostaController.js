const prisma = require('../lib/prisma');
const bosta = require('../utils/bosta');

const serializeLite = (order) => ({
  id: order.id,
  status: order.status,
  paymentMethod: order.paymentMethod,
  isPaid: order.isPaid,
  totalPrice: Number(order.totalPrice),
  bostaTrackingNumber: order.bostaTrackingNumber,
  shippingCarrier: order.shippingCarrier,
  shippingStatus: order.shippingStatus,
});

const orderInclude = {
  items: true,
  user: { select: { id: true, name: true, email: true, phone: true } },
};

const isCodMethod = (method) =>
  /cash\s*on\s*delivery|\bcod\b/i.test(String(method || ''));

const isPaymobMethod = (method) =>
  /paymob|card\s*\/\s*wallet/i.test(String(method || ''));

const isInstaPayMethod = (method) =>
  String(method || '')
    .toLowerCase()
    .includes('instapay');

/**
 * Confirm order (if still pending) and create a Bosta shipment when configured.
 * Idempotent — safe to call multiple times.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.confirm=true] - promote pending → confirmed
 * @param {boolean} [opts.force=false] - ship even if unpaid (staff retry)
 */
const fulfillOrderWithBosta = async (
  orderOrId,
  { confirm = true, force = false } = {}
) => {
  let order =
    typeof orderOrId === 'string'
      ? await prisma.order.findUnique({ where: { id: orderOrId }, include: orderInclude })
      : orderOrId;

  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }

  if (order.status === 'canceled') {
    return { order, shipped: false, skipped: 'canceled' };
  }

  if (confirm && order.status === 'pending') {
    order = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'confirmed' },
      include: orderInclude,
    });
  }

  if (order.bostaDeliveryId || order.bostaTrackingNumber) {
    return { order, shipped: false, skipped: 'already_shipped' };
  }

  // Auto-ship only for COD, or once prepaid (Paymob / InstaPay) is paid.
  // Staff can pass force=true to retry anyway.
  const cod = isCodMethod(order.paymentMethod);
  if (!force && !cod && !order.isPaid) {
    return { order, shipped: false, skipped: 'awaiting_payment' };
  }

  if (!bosta.isConfigured()) {
    return { order, shipped: false, skipped: 'bosta_not_configured' };
  }

  if (!order.items || !Array.isArray(order.items)) {
    order = await prisma.order.findUnique({ where: { id: order.id }, include: orderInclude });
  }

  const isPaymob = isPaymobMethod(order.paymentMethod);
  const codAmount = cod && !order.isPaid && !isPaymob ? Number(order.totalPrice) : 0;

  try {
    const result = await bosta.createDelivery({
      orderId: order.id,
      customerName: order.user?.name || order.guestName || 'Customer',
      phone:
        order.user?.phone ||
        order.guestPhone ||
        order.shippingAddress?.phone ||
        '',
      email: order.user?.email || order.guestEmail,
      address: order.shippingAddress || {},
      codAmount,
      itemsCount: (order.items || []).reduce((n, i) => n + (i.qty || 0), 0),
      description: (order.items || []).map((i) => i.name).join(', ').slice(0, 180),
      notes: [
        `FutureFit order ${order.id}`,
        order.shippingAddress?.city
          ? `District: ${order.shippingAddress.city}`
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
    });

    order = await prisma.order.update({
      where: { id: order.id },
      data: {
        bostaDeliveryId: result.deliveryId ? String(result.deliveryId) : null,
        bostaTrackingNumber: result.trackingNumber ? String(result.trackingNumber) : null,
        shippingCarrier: 'bosta',
        shippingStatus: 'created',
        status: order.status === 'pending' ? 'confirmed' : order.status,
      },
      include: orderInclude,
    });

    return { order, shipped: true, trackingNumber: order.bostaTrackingNumber };
  } catch (err) {
    console.error('Auto Bosta sync failed for', order.id, err.message);
    return { order, shipped: false, skipped: 'bosta_error', error: err.message };
  }
};

/** Staff: create Bosta shipment for an order (manual retry) */
const createShipment = async (req, res) => {
  try {
    if (!bosta.isConfigured()) {
      return res.status(503).json({
        message: 'Bosta is not configured. Add BOSTA_API_KEY on the server.',
      });
    }

    const result = await fulfillOrderWithBosta(req.params.id, {
      confirm: true,
      force: true,
    });
    if (result.skipped === 'already_shipped') {
      return res.status(400).json({
        message: 'Shipment already created',
        trackingNumber: result.order.bostaTrackingNumber,
        deliveryId: result.order.bostaDeliveryId,
      });
    }
    if (result.skipped === 'bosta_error') {
      return res.status(502).json({ message: result.error || 'Bosta shipment failed' });
    }

    const updated = result.order;
    res.json({
      ...serializeLite(updated),
      itemsPrice: Number(updated.itemsPrice),
      shippingPrice: Number(updated.shippingPrice),
      discountAmount: Number(updated.discountAmount),
      totalPrice: Number(updated.totalPrice),
      customerName: updated.user?.name || updated.guestName,
      customerPhone: updated.user?.phone || updated.guestPhone,
      shippingAddress: updated.shippingAddress,
      paymentMethod: updated.paymentMethod,
      isPaid: updated.isPaid,
      status: updated.status,
      items: updated.items,
    });
  } catch (err) {
    console.error('Bosta createShipment:', err);
    res.status(err.status || 500).json({ message: err.message || 'Bosta shipment failed' });
  }
};

const extractWebhookState = (body = {}) => {
  const raw =
    body.state ??
    body.currentState ??
    body.data?.state ??
    body.delivery?.state ??
    null;
  if (raw == null) return null;
  if (typeof raw === 'object') {
    return raw.code ?? raw.value ?? raw.name ?? null;
  }
  return raw;
};

/** Bosta delivery state webhook */
const handleWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    const trackingNumber =
      body.trackingNumber ||
      body.tracking_number ||
      body.data?.trackingNumber ||
      body.delivery?.trackingNumber;
    const deliveryId =
      body._id || body.deliveryId || body.data?._id || body.delivery?._id;
    const state = extractWebhookState(body);
    const businessReference =
      body.businessReference || body.data?.businessReference || body.delivery?.businessReference;

    let order = null;
    if (trackingNumber) {
      order = await prisma.order.findFirst({
        where: { bostaTrackingNumber: String(trackingNumber) },
      });
    }
    if (!order && deliveryId) {
      order = await prisma.order.findFirst({
        where: { bostaDeliveryId: String(deliveryId) },
      });
    }
    if (!order && businessReference) {
      const ref = String(businessReference);
      const id = ref.replace(/^FF-/i, '');
      order = await prisma.order.findUnique({ where: { id } }).catch(() => null);
      if (!order && id.length >= 8) {
        order = await prisma.order.findFirst({
          where: { id: { startsWith: id.slice(0, 8) } },
        });
      }
    }

    if (!order) {
      return res.status(200).json({ received: true, matched: false });
    }

    const nextStatus = bosta.mapBostaStateToOrderStatus(state);
    const data = {
      shippingStatus: state != null ? String(state) : order.shippingStatus,
      shippingCarrier: 'bosta',
    };
    if (trackingNumber && !order.bostaTrackingNumber) {
      data.bostaTrackingNumber = String(trackingNumber);
    }
    if (deliveryId && !order.bostaDeliveryId) {
      data.bostaDeliveryId = String(deliveryId);
    }
    if (nextStatus && order.status !== 'canceled') {
      const rank = {
        pending: 0,
        confirmed: 1,
        out_for_delivery: 2,
        delivered: 3,
        problem: 2,
        canceled: 9,
      };
      if ((rank[nextStatus] ?? 0) >= (rank[order.status] ?? 0) || nextStatus === 'problem') {
        data.status = nextStatus;
      }
      if (nextStatus === 'delivered') {
        data.deliveredAt = order.deliveredAt || new Date();
        // COD cash is collected at the door — mark paid when Bosta confirms delivery.
        if (isCodMethod(order.paymentMethod) || Number(body.cod) > 0) {
          data.isPaid = true;
          data.paidAt = order.paidAt || new Date();
        }
      }
    }

    await prisma.order.update({ where: { id: order.id }, data });
    return res.status(200).json({ received: true, matched: true, status: nextStatus });
  } catch (err) {
    console.error('Bosta webhook error:', err);
    return res.status(200).json({ received: true, error: true });
  }
};

module.exports = {
  createShipment,
  handleWebhook,
  fulfillOrderWithBosta,
  isCodMethod,
  isPaymobMethod,
  isInstaPayMethod,
};
