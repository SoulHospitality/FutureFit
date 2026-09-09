const crypto = require('crypto');

const BASE_URL = (process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com').replace(/\/$/, '');
const SECRET_KEY = process.env.PAYMOB_SECRET_KEY || '';
const PUBLIC_KEY = process.env.PAYMOB_PUBLIC_KEY || '';
const HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET || '';
const CURRENCY = process.env.PAYMOB_CURRENCY || 'EGP';

const integrationIds = () =>
  String(process.env.PAYMOB_INTEGRATION_IDS || process.env.PAYMOB_INTEGRATION_ID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (Number.isFinite(Number(s)) ? Number(s) : s));

const isConfigured = () =>
  Boolean(SECRET_KEY && PUBLIC_KEY && integrationIds().length > 0);

const clientUrl = () =>
  (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(
    /\/$/,
    ''
  );

const apiPublicUrl = () =>
  (process.env.API_PUBLIC_URL || process.env.APP_URL || 'http://localhost:5000').replace(
    /\/$/,
    ''
  );

/**
 * Create a Paymob Intention and return checkout URL for Unified Checkout.
 * Amount must be in cents (piastres for EGP).
 */
const createIntention = async ({
  orderId,
  amountEgp,
  items = [],
  customer = {},
  billing = {},
}) => {
  if (!isConfigured()) {
    const err = new Error('Paymob is not configured');
    err.status = 503;
    throw err;
  }

  const amountCents = Math.round(Number(amountEgp) * 100);
  if (!Number.isFinite(amountCents) || amountCents < 1) {
    const err = new Error('Invalid payment amount');
    err.status = 400;
    throw err;
  }

  const firstName = String(customer.firstName || billing.firstName || 'Customer').slice(0, 50);
  const lastName = String(customer.lastName || billing.lastName || 'FutureFit').slice(0, 50);
  const email = String(customer.email || billing.email || 'orders@futurefit.eg').slice(0, 100);
  const phone = String(customer.phone || billing.phone || '01000000000').replace(/\s+/g, '');

  const payload = {
    amount: amountCents,
    currency: CURRENCY,
    payment_methods: integrationIds(),
    items: items.map((i) => ({
      name: String(i.name || 'Item').slice(0, 120),
      amount: Math.round(Number(i.price) * 100),
      description: String(i.name || '').slice(0, 120),
      quantity: Number(i.qty) || 1,
    })),
    special_reference: String(orderId),
    billing_data: {
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: phone,
      apartment: billing.apartment || 'NA',
      floor: billing.floor || 'NA',
      street: billing.street || 'NA',
      building: billing.building || 'NA',
      shipping_method: 'NA',
      postal_code: billing.zip || 'NA',
      city: billing.city || 'Cairo',
      state: billing.state || 'Cairo',
      country: billing.country === 'Egypt' ? 'EGY' : billing.country || 'EGY',
    },
    customer: {
      first_name: firstName,
      last_name: lastName,
      email,
    },
    notification_url: `${apiPublicUrl()}/api/paymob/webhook`,
    redirection_url: `${clientUrl()}/order-success?orderId=${encodeURIComponent(orderId)}`,
  };

  const res = await fetch(`${BASE_URL}/v1/intention/`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.detail ||
      data?.message ||
      (typeof data === 'string' ? data : null) ||
      `Paymob intention failed (${res.status})`;
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    err.status = 502;
    throw err;
  }

  const clientSecret = data.client_secret;
  if (!clientSecret) {
    const err = new Error('Paymob did not return a client secret');
    err.status = 502;
    throw err;
  }

  return {
    intentionId: data.id || data.intention_id || null,
    clientSecret,
    checkoutUrl: `${BASE_URL}/unifiedcheckout/?publicKey=${encodeURIComponent(PUBLIC_KEY)}&clientSecret=${encodeURIComponent(clientSecret)}`,
  };
};

const HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
];

const getNested = (obj, path) => {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
};

const verifyTransactionHmac = (obj, hmacFromQuery) => {
  if (!HMAC_SECRET) {
    console.warn('PAYMOB_HMAC_SECRET not set — skipping HMAC verification (unsafe in production)');
    return true;
  }
  if (!hmacFromQuery || !obj) return false;

  const concatenated = HMAC_FIELDS.map((field) => {
    const value = getNested(obj, field);
    if (value === null || value === undefined) return '';
    return String(value);
  }).join('');

  const digest = crypto.createHmac('sha512', HMAC_SECRET).update(concatenated).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(String(hmacFromQuery)));
  } catch {
    return digest === String(hmacFromQuery);
  }
};

module.exports = {
  isConfigured,
  createIntention,
  verifyTransactionHmac,
  PUBLIC_KEY,
  BASE_URL,
};
