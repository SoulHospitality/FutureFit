const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { getSettings, siteUrlFrom } = require('./marketing');

const GRAPH_VERSION = 'v21.0';

const sha256 = (value) => {
  const v = String(value ?? '').trim().toLowerCase();
  return v ? crypto.createHash('sha256').update(v).digest('hex') : undefined;
};

/** Meta wants digits with country code, no leading zeros or "+". Egyptian numbers default to 20. */
const normalizePhone = (phone) => {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 11) d = `20${d.slice(1)}`;
  if (d.length === 10 && d.startsWith('1')) d = `20${d}`;
  return d;
};

const splitName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return { fn: parts[0] || '', ln: parts.length > 1 ? parts[parts.length - 1] : '' };
};

const compact = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== '' && v !== null));

/**
 * Server-side Purchase for Meta (Conversions API). Uses the order id as event_id so it
 * de-duplicates against the browser pixel's Purchase on the success page.
 * Never throws — marketing must not break checkout.
 */
const sendMetaPurchase = async (orderOrId) => {
  try {
    const settings = await getSettings();
    const { metaPixelId, metaCapiToken, metaTestEventCode } = settings.tracking;
    if (!metaPixelId || !metaCapiToken) return { skipped: true };

    const order =
      typeof orderOrId === 'string'
        ? await prisma.order.findUnique({
            where: { id: orderOrId },
            include: { items: true, user: { select: { id: true, name: true, email: true, phone: true } } },
          })
        : orderOrId;
    if (!order) return { skipped: true };

    const attribution = order.attribution && typeof order.attribution === 'object' ? order.attribution : {};
    const address = order.shippingAddress && typeof order.shippingAddress === 'object' ? order.shippingAddress : {};
    const email = order.user?.email || order.guestEmail || '';
    const phone = order.user?.phone || order.guestPhone || address.phone || '';
    const { fn, ln } = splitName(order.user?.name || order.guestName || address.fullName || '');
    const items = order.items || [];

    const event = {
      event_name: 'Purchase',
      event_time: Math.floor(new Date(order.createdAt || Date.now()).getTime() / 1000),
      event_id: String(order.id),
      action_source: 'website',
      event_source_url: attribution.landingUrl || `${siteUrlFrom(settings)}/order-success`,
      user_data: compact({
        em: email ? [sha256(email)] : undefined,
        ph: phone ? [sha256(normalizePhone(phone))] : undefined,
        fn: fn ? [sha256(fn)] : undefined,
        ln: ln ? [sha256(ln)] : undefined,
        ct: address.city ? [sha256(String(address.city).replace(/\s+/g, ''))] : undefined,
        st: address.state ? [sha256(String(address.state).replace(/\s+/g, ''))] : undefined,
        country: [sha256('eg')],
        external_id: [sha256(order.userId || normalizePhone(phone) || order.id)],
        client_ip_address: attribution.clientIp || undefined,
        client_user_agent: attribution.userAgent || undefined,
        fbp: attribution.fbp || undefined,
        fbc: attribution.fbc || undefined,
      }),
      custom_data: {
        currency: 'EGP',
        value: Number(order.totalPrice) || 0,
        order_id: String(order.id),
        content_type: 'product',
        content_ids: items.map((i) => String(i.productId)),
        contents: items.map((i) => ({
          id: String(i.productId),
          quantity: Number(i.qty) || 1,
          item_price: Number(i.price) || 0,
        })),
        num_items: items.reduce((s, i) => s + (Number(i.qty) || 0), 0),
      },
    };

    const body = { data: [event], ...(metaTestEventCode ? { test_event_code: metaTestEventCode } : {}) };
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${metaPixelId}/events?access_token=${encodeURIComponent(metaCapiToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('Meta CAPI Purchase failed:', json?.error?.message || res.status);
      return { ok: false, error: json?.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true, eventsReceived: json.events_received };
  } catch (err) {
    console.warn('Meta CAPI Purchase error:', err.message);
    return { ok: false, error: err.message };
  }
};

module.exports = { sendMetaPurchase };
