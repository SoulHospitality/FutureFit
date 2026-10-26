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
    const { metaPixelId, metaCapiToken } = settings.tracking;
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
        ph: normalizePhone(phone).length >= 10 ? [sha256(normalizePhone(phone))] : undefined,
        fn: fn ? [sha256(fn)] : undefined,
        ln: ln ? [sha256(ln)] : undefined,
        ct: address.city ? [sha256(String(address.city).replace(/\s+/g, ''))] : undefined,
        st: address.state ? [sha256(String(address.state).replace(/\s+/g, ''))] : undefined,
        country: [sha256('eg')],
        external_id: [sha256(order.userId || normalizePhone(phone) || order.id)],
        client_ip_address: cleanIp(attribution.clientIp),
        client_user_agent: attribution.userAgent || undefined,
        fbp: validFbp(attribution.fbp),
        fbc: validFbc(attribution.fbc),
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
        content_name: items.map((i) => i.name).filter(Boolean).join(', ').slice(0, 200) || undefined,
      },
    };

    // Live purchases stay in Events Manager. The test code is only for the staff test button.
    let result = await postMetaEvent(metaPixelId, metaCapiToken, event);
    if (!result.ok) result = await postMetaEvent(metaPixelId, metaCapiToken, event);
    if (!result.ok) {
      console.warn('Meta CAPI Purchase failed:', result.json?.error?.message || result.status);
      return { ok: false, error: result.json?.error?.message || `HTTP ${result.status}` };
    }
    return { ok: true, eventsReceived: result.json.events_received };
  } catch (err) {
    console.warn('Meta CAPI Purchase error:', err.message);
    return { ok: false, error: err.message };
  }
};

const ALLOWED_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
]);

const validFbp = (value) => (/^fb\.1\.\d{10,}\.[\w-]+$/.test(String(value || '')) ? String(value).slice(0, 120) : undefined);

const validFbc = (value) => (/^fb\.1\.\d{10,}\.[\w-]+$/.test(String(value || '')) ? String(value).slice(0, 200) : undefined);

const cleanIp = (value) => {
  let ip = String(value || '').trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (!ip || ip === '::1' || ip === '127.0.0.1') return undefined;
  return ip.slice(0, 64);
};

const cleanId = (value) => String(value || '').trim().slice(0, 80);

const cleanCustomData = (raw) => {
  if (!raw || typeof raw !== 'object') return undefined;
  const contentIds = Array.isArray(raw.content_ids)
    ? raw.content_ids.map(cleanId).filter(Boolean).slice(0, 20)
    : [];
  const contents = Array.isArray(raw.contents)
    ? raw.contents
        .slice(0, 20)
        .map((row) => {
          const id = cleanId(row?.id);
          if (!id) return null;
          const quantity = Math.max(1, Math.min(99, Math.floor(Number(row.quantity) || 1)));
          const itemPrice = Number(row.item_price);
          return {
            id,
            quantity,
            ...(Number.isFinite(itemPrice) && itemPrice >= 0 ? { item_price: itemPrice } : {}),
          };
        })
        .filter(Boolean)
    : [];
  const value = Number(raw.value);
  const contentType = raw.content_type === 'product_group' ? 'product_group' : raw.content_type === 'product' ? 'product' : '';
  const counted = contents.length
    ? contents.reduce((sum, row) => sum + row.quantity, 0)
    : Math.floor(Number(raw.num_items) || 0);
  const out = compact({
    currency: raw.currency || raw.content_name || contentIds.length || contents.length ? 'EGP' : undefined,
    value: Number.isFinite(value) && value >= 0 ? Math.min(value, 10_000_000) : undefined,
    content_name: raw.content_name ? String(raw.content_name).slice(0, 200) : undefined,
    content_category: raw.content_category ? String(raw.content_category).slice(0, 120) : undefined,
    content_type: contentType || undefined,
    content_ids: contentIds.length ? contentIds : undefined,
    contents: contents.length ? contents : undefined,
    num_items: counted > 0 ? counted : undefined,
    order_id: raw.order_id ? cleanId(raw.order_id) : undefined,
  });
  return Object.keys(out).length ? out : undefined;
};

const postMetaEvent = async (pixelId, token, event) => {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event] }),
      signal: AbortSignal.timeout(8000),
    }
  );
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json, status: res.status };
};

/**
 * Browser funnel events (PageView, shop list, product view, add to cart) mirrored
 * server-side so Meta still receives them when the pixel is blocked.
 * event_id matches the pixel call so Meta counts the pair once.
 */
const sendMetaWebsiteEvent = async ({ eventName, eventId, eventSourceUrl, customData, fbp, fbc, clientIp, userAgent }) => {
  try {
    if (!ALLOWED_EVENTS.has(eventName)) return { skipped: true };
    const settings = await getSettings();
    const { metaPixelId, metaCapiToken } = settings.tracking;
    if (!metaPixelId || !metaCapiToken) return { skipped: true };

    const custom = cleanCustomData(customData);
    const id = String(eventId || crypto.randomUUID()).slice(0, 80);
    const ip = cleanIp(clientIp);
    const agent = userAgent ? String(userAgent).slice(0, 500) : undefined;
    const event = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: id,
      action_source: 'website',
      event_source_url: String(eventSourceUrl || siteUrlFrom(settings)).slice(0, 500),
      user_data: compact({
        client_ip_address: ip,
        client_user_agent: agent,
        fbp: validFbp(fbp),
        fbc: validFbc(fbc),
        ...(!ip && !agent ? { external_id: [sha256(id)] } : {}),
      }),
      ...(custom ? { custom_data: custom } : {}),
    };

    let result = await postMetaEvent(metaPixelId, metaCapiToken, event);
    if (!result.ok) result = await postMetaEvent(metaPixelId, metaCapiToken, event);
    if (!result.ok) {
      console.warn(`Meta CAPI ${eventName} failed:`, result.json?.error?.message || result.status);
      return { ok: false, error: result.json?.error?.message || `HTTP ${result.status}` };
    }
    return { ok: true, eventsReceived: result.json.events_received };
  } catch (err) {
    console.warn('Meta CAPI website event error:', err.message);
    return { ok: false };
  }
};

module.exports = { sendMetaPurchase, sendMetaWebsiteEvent };
