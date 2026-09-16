/** Meta (Facebook) Pixel — browser events for ads attribution. */

export const META_PIXEL_ID =
  import.meta.env.VITE_META_PIXEL_ID || '484242591335280';

const currency = () => 'EGP';

export const isMetaPixelEnabled = () => Boolean(META_PIXEL_ID);

export function initMetaPixel() {
  if (typeof window === 'undefined' || !META_PIXEL_ID) return;
  if (window.fbq) return;

  // Standard Meta pixel bootstrap
  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  window.fbq('init', META_PIXEL_ID);
}

export function trackMeta(event, data, options) {
  if (typeof window === 'undefined' || !window.fbq || !META_PIXEL_ID) return;
  if (options?.eventID) {
    window.fbq('track', event, data || {}, { eventID: options.eventID });
  } else {
    window.fbq('track', event, data || {});
  }
}

export function trackPageView() {
  trackMeta('PageView');
}

export function trackViewContent(product) {
  if (!product?.id) return;
  const value =
    product.isSaleActive && product.salePrice != null
      ? Number(product.salePrice)
      : Number(product.price) || 0;
  trackMeta('ViewContent', {
    content_ids: [String(product.id)],
    content_name: product.name,
    content_type: 'product',
    value,
    currency: currency(),
  });
}

export function trackAddToCart({ productId, name, price, qty = 1 }) {
  trackMeta('AddToCart', {
    content_ids: [String(productId)],
    content_name: name,
    content_type: 'product',
    value: Number(price) * Number(qty || 1),
    currency: currency(),
    contents: [{ id: String(productId), quantity: Number(qty) || 1 }],
  });
}

export function trackInitiateCheckout({ items = [], value = 0 } = {}) {
  trackMeta('InitiateCheckout', {
    content_ids: items.map((i) => String(i.productId)),
    contents: items.map((i) => ({
      id: String(i.productId),
      quantity: Number(i.qty) || 1,
    })),
    num_items: items.reduce((s, i) => s + (Number(i.qty) || 0), 0),
    value: Number(value) || 0,
    currency: currency(),
  });
}

export function trackPurchase(order) {
  if (!order?.id) return;
  const dedupeKey = `ff_meta_purchase_${order.id}`;
  try {
    if (sessionStorage.getItem(dedupeKey)) return;
    sessionStorage.setItem(dedupeKey, '1');
  } catch {
    /* ignore */
  }

  const items = order.items || [];
  trackMeta(
    'Purchase',
    {
      content_ids: items.map((i) => String(i.productId)),
      contents: items.map((i) => ({
        id: String(i.productId),
        quantity: Number(i.qty) || 1,
      })),
      num_items: items.reduce((s, i) => s + (Number(i.qty) || 0), 0),
      value: Number(order.totalPrice) || 0,
      currency: currency(),
    },
    { eventID: String(order.id) }
  );
}
