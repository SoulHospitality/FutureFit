const BASE_URL = (process.env.BOSTA_BASE_URL || 'https://app.bosta.co').replace(/\/$/, '');
const API_KEY = process.env.BOSTA_API_KEY || '';

const isConfigured = () => Boolean(API_KEY);

const apiPublicUrl = () =>
  (process.env.API_PUBLIC_URL || process.env.APP_URL || 'http://localhost:5000').replace(
    /\/$/,
    ''
  );

/** Normalize Egyptian mobile for Bosta (01xxxxxxxxx). */
const normalizeEgyptPhone = (phone) => {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.startsWith('0020')) p = p.slice(4);
  if (p.startsWith('20') && p.length >= 11) p = p.slice(2);
  if (p.length === 10 && p.startsWith('1')) p = `0${p}`;
  return p;
};

const request = async (method, path, body) => {
  if (!isConfigured()) {
    const err = new Error('Bosta is not configured');
    err.status = 503;
    throw err;
  }

  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: API_KEY,
      'Content-Type': 'application/json',
      'X-Requested-By': 'futurefit',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.message ||
      data?.error ||
      data?.detail ||
      (typeof data === 'string' ? data : null) ||
      `Bosta request failed (${res.status})`;
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    err.status = res.status >= 400 && res.status < 500 ? res.status : 502;
    err.payload = data;
    throw err;
  }
  return data;
};

const splitName = (fullName) => {
  const parts = String(fullName || 'Customer').trim().split(/\s+/);
  const firstName = parts[0] || 'Customer';
  const lastName = parts.slice(1).join(' ') || 'FutureFit';
  return { firstName, lastName };
};

/**
 * Create a Bosta SEND delivery for an order.
 * Pickup uses the business default location from the Bosta dashboard
 * (or BOSTA_BUSINESS_LOCATION_ID if set). Only BOSTA_API_KEY is required.
 */
const createDelivery = async ({
  orderId,
  customerName,
  phone,
  email,
  address = {},
  codAmount = 0,
  notes = '',
  itemsCount = 1,
  description = 'FutureFit order',
}) => {
  const { firstName, lastName } = splitName(customerName);
  const normalizedPhone = normalizeEgyptPhone(phone);
  if (!normalizedPhone || normalizedPhone.length < 10) {
    const err = new Error('A valid Egyptian phone number is required for shipping');
    err.status = 400;
    throw err;
  }

  const dropCity = address.city || address.state || 'Cairo';
  const dropZone = address.state || address.city || dropCity;
  const dropLine = [address.street, address.zip].filter(Boolean).join(', ') || 'Address TBD';

  const payload = {
    type: 10,
    cod: Math.max(0, Math.round(Number(codAmount) || 0)),
    businessReference: `${process.env.BOSTA_REF_PREFIX || 'FF'}-${String(orderId).slice(0, 8)}`,
    notes: notes || `FutureFit order ${orderId}`,
    webhookUrl: `${apiPublicUrl()}/api/bosta/webhook`,
    receiver: {
      firstName,
      lastName,
      phone: normalizedPhone,
      email: email || undefined,
    },
    dropOffAddress: {
      city: dropCity,
      zone: dropZone,
      firstLine: dropLine,
      secondLine: address.country || 'Egypt',
    },
    specs: {
      packageDetails: {
        itemsCount: Math.max(1, Number(itemsCount) || 1),
        description: String(description).slice(0, 200),
      },
    },
  };

  // If set, pick up from this location; otherwise Bosta uses the account default
  const locationId = process.env.BOSTA_BUSINESS_LOCATION_ID?.trim();
  if (locationId) payload.businessLocationId = locationId;

  const data = await request('POST', '/api/v2/deliveries?apiVersion=1', payload);
  const inner = data?.data || data;

  return {
    deliveryId: inner?._id || inner?.id || inner?.deliveryId || null,
    trackingNumber: inner?.trackingNumber || inner?.tracking_number || null,
    raw: data,
  };
};

/** Map common Bosta state codes/labels → FutureFit OrderStatus */
const mapBostaStateToOrderStatus = (state) => {
  const s = String(state || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  if (!s) return null;
  if (['delivered', 'completed'].some((k) => s.includes(k))) return 'delivered';
  if (
    ['pickedup', 'pickingup', 'intransit', 'outfordelivery', 'onhold', 'headingtocustomer'].some(
      (k) => s.includes(k)
    )
  ) {
    return 'out_for_delivery';
  }
  if (['canceled', 'cancelled', 'terminated', 'returned', 'rto'].some((k) => s.includes(k))) {
    return 'canceled';
  }
  if (['exception', 'failed', 'problem', 'returnedtocorporate'].some((k) => s.includes(k))) {
    return 'problem';
  }
  if (['created', 'waitingforroute', 'receivedatwarehouse', 'new'].some((k) => s.includes(k))) {
    return 'confirmed';
  }
  return null;
};

module.exports = {
  isConfigured,
  createDelivery,
  mapBostaStateToOrderStatus,
  normalizeEgyptPhone,
};
