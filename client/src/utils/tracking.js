/**
 * One place for every ads / analytics platform. Pages call trackViewContent, trackAddToCart …
 * and this fans the event out to whichever platforms have an ID in Staff → Marketing:
 * Google Analytics 4, Google Ads, Google Tag Manager, Meta Pixel, TikTok Pixel, Microsoft Clarity.
 */

const CURRENCY = 'EGP';
const MAX_QUEUE = 60;

let ids = {};
let ready = false;
const queue = [];

const loadScript = (src) => {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
};

function bootMeta(id) {
  if (!window.fbq) {
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
  }
  window.fbq('init', id);
}

function bootTikTok(id) {
  !(function (w, d, t) {
    w.TiktokAnalyticsObject = t;
    var ttq = (w[t] = w[t] || []);
    ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
    ttq.setAndDefer = function (t, e) {
      t[e] = function () {
        t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
      };
    };
    for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.instance = function (t) {
      for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
      return e;
    };
    ttq.load = function (e, n) {
      var r = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i = ttq._i || {};
      ttq._i[e] = [];
      ttq._i[e]._u = r;
      ttq._t = ttq._t || {};
      ttq._t[e] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[e] = n || {};
      var o = d.createElement('script');
      o.type = 'text/javascript';
      o.async = !0;
      o.src = r + '?sdkid=' + e + '&lib=' + t;
      var a = d.getElementsByTagName('script')[0];
      a.parentNode.insertBefore(o, a);
    };
    ttq.load(id);
  })(window, document, 'ttq');
}

function bootClarity(id) {
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () {
      (c[a].q = c[a].q || []).push(arguments);
    };
    t = l.createElement(r);
    t.async = 1;
    t.src = 'https://www.clarity.ms/tag/' + i;
    y = l.getElementsByTagName(r)[0];
    y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', id);
}

function bootGoogle({ ga4Id, googleAdsId, gtmId }) {
  window.dataLayer = window.dataLayer || [];
  if (gtmId) {
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    loadScript(`https://www.googletagmanager.com/gtm.js?id=${gtmId}`);
  }
  if (ga4Id || googleAdsId) {
    window.gtag = function gtag() {
      // gtag.js expects the Arguments object itself, not an array
      window.dataLayer.push(arguments);
    };
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${ga4Id || googleAdsId}`);
    window.gtag('js', new Date());
    // GA4 records SPA page views itself via enhanced measurement (browser history changes)
    if (ga4Id) window.gtag('config', ga4Id);
    if (googleAdsId) window.gtag('config', googleAdsId);
  }
}

/** Call once with the public tracking config; safe to call again (no-op). */
export function initTracking(tracking) {
  if (ready || typeof window === 'undefined' || !tracking) return;
  ids = { ...tracking };
  try {
    if (ids.gtmId || ids.ga4Id || ids.googleAdsId) bootGoogle(ids);
    if (ids.metaPixelId) bootMeta(ids.metaPixelId);
    if (ids.tiktokPixelId) bootTikTok(ids.tiktokPixelId);
    if (ids.clarityId) bootClarity(ids.clarityId);
  } catch (err) {
    console.warn('Tracking init failed', err);
  }
  ready = true;
  queue.splice(0).forEach((fn) => fn());
}

const run = (fn) => {
  if (typeof window === 'undefined') return;
  if (ready) {
    try {
      fn();
    } catch {
      /* never break the store for analytics */
    }
  } else if (queue.length < MAX_QUEUE) {
    queue.push(() => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  }
};

const gtagEvent = (name, params) => {
  if (window.gtag && (ids.ga4Id || ids.googleAdsId)) window.gtag('event', name, params);
};
const gtmEvent = (event, ecommerce) => {
  if (!ids.gtmId || !window.dataLayer) return;
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({ event, ecommerce });
};
const fbq = (event, data, eventID) => {
  if (!window.fbq || !ids.metaPixelId) return;
  if (eventID) window.fbq('track', event, data, { eventID });
  else window.fbq('track', event, data);
};
const ttq = (event, data, eventId) => {
  if (!window.ttq || !ids.tiktokPixelId) return;
  window.ttq.track(event, data, eventId ? { event_id: eventId } : undefined);
};

const unitPrice = (product) =>
  product?.isSaleActive && product?.salePrice != null
    ? Number(product.salePrice)
    : Number(product?.price) || 0;

const gaItem = ({ id, name, price, qty = 1, category }) => ({
  item_id: String(id),
  item_name: name || '',
  price: Number(price) || 0,
  quantity: Number(qty) || 1,
  ...(category ? { item_category: category } : {}),
  google_business_vertical: 'retail',
});

// ── Public events ───────────────────────────────────────────────────────────

export function trackPageView() {
  run(() => {
    fbq('PageView');
    if (window.ttq && ids.tiktokPixelId) window.ttq.page();
    if (ids.gtmId && window.dataLayer) {
      window.dataLayer.push({
        event: 'page_view',
        page_location: window.location.href,
        page_path: window.location.pathname + window.location.search,
        page_title: document.title,
      });
    }
  });
}

export function trackViewContent(product) {
  if (!product?.id) return;
  run(() => {
    const value = unitPrice(product);
    const category = product.category?.name;
    const item = gaItem({ id: product.id, name: product.name, price: value, category });
    gtagEvent('view_item', { currency: CURRENCY, value, items: [item] });
    gtmEvent('view_item', { currency: CURRENCY, value, items: [item] });
    fbq('ViewContent', {
      content_ids: [String(product.id)],
      content_name: product.name,
      content_type: 'product',
      value,
      currency: CURRENCY,
    });
    ttq('ViewContent', {
      contents: [{ content_id: String(product.id), content_name: product.name, price: value, quantity: 1 }],
      content_type: 'product',
      value,
      currency: CURRENCY,
    });
  });
}

export function trackAddToCart({ productId, name, price, qty = 1 }) {
  run(() => {
    const quantity = Number(qty) || 1;
    const value = (Number(price) || 0) * quantity;
    const item = gaItem({ id: productId, name, price, qty: quantity });
    gtagEvent('add_to_cart', { currency: CURRENCY, value, items: [item] });
    gtmEvent('add_to_cart', { currency: CURRENCY, value, items: [item] });
    fbq('AddToCart', {
      content_ids: [String(productId)],
      content_name: name,
      content_type: 'product',
      value,
      currency: CURRENCY,
      contents: [{ id: String(productId), quantity }],
    });
    ttq('AddToCart', {
      contents: [{ content_id: String(productId), content_name: name, price: Number(price) || 0, quantity }],
      content_type: 'product',
      value,
      currency: CURRENCY,
    });
  });
}

export function trackInitiateCheckout({ items = [], value = 0 } = {}) {
  run(() => {
    const total = Number(value) || 0;
    const gaItems = items.map((i) => gaItem({ id: i.productId, name: i.name, price: i.price, qty: i.qty }));
    gtagEvent('begin_checkout', { currency: CURRENCY, value: total, items: gaItems });
    gtmEvent('begin_checkout', { currency: CURRENCY, value: total, items: gaItems });
    fbq('InitiateCheckout', {
      content_ids: items.map((i) => String(i.productId)),
      contents: items.map((i) => ({ id: String(i.productId), quantity: Number(i.qty) || 1 })),
      num_items: items.reduce((s, i) => s + (Number(i.qty) || 0), 0),
      value: total,
      currency: CURRENCY,
    });
    ttq('InitiateCheckout', {
      contents: items.map((i) => ({
        content_id: String(i.productId),
        content_name: i.name,
        price: Number(i.price) || 0,
        quantity: Number(i.qty) || 1,
      })),
      content_type: 'product',
      value: total,
      currency: CURRENCY,
    });
  });
}

/** Fires once per order on this device; the order id doubles as the de-duplication key everywhere. */
export function trackPurchase(order) {
  if (!order?.id) return;
  const dedupeKey = `ff_purchase_${order.id}`;
  try {
    if (localStorage.getItem(dedupeKey)) return;
    localStorage.setItem(dedupeKey, '1');
  } catch {
    /* ignore */
  }

  run(() => {
    const items = order.items || [];
    const value = Number(order.totalPrice) || 0;
    const orderId = String(order.id);
    const gaItems = items.map((i) => gaItem({ id: i.productId, name: i.name, price: i.price, qty: i.qty }));
    const purchase = {
      transaction_id: orderId,
      currency: CURRENCY,
      value,
      shipping: Number(order.shippingPrice) || 0,
      ...(order.couponCode ? { coupon: order.couponCode } : {}),
      items: gaItems,
    };
    gtagEvent('purchase', purchase);
    gtmEvent('purchase', purchase);
    if (window.gtag && ids.googleAdsId && ids.googleAdsPurchaseLabel) {
      window.gtag('event', 'conversion', {
        send_to: `${ids.googleAdsId}/${ids.googleAdsPurchaseLabel}`,
        value,
        currency: CURRENCY,
        transaction_id: orderId,
      });
    }
    fbq(
      'Purchase',
      {
        content_ids: items.map((i) => String(i.productId)),
        contents: items.map((i) => ({ id: String(i.productId), quantity: Number(i.qty) || 1 })),
        content_type: 'product',
        num_items: items.reduce((s, i) => s + (Number(i.qty) || 0), 0),
        value,
        currency: CURRENCY,
      },
      orderId
    );
    ttq(
      'CompletePayment',
      {
        contents: items.map((i) => ({
          content_id: String(i.productId),
          content_name: i.name,
          price: Number(i.price) || 0,
          quantity: Number(i.qty) || 1,
        })),
        content_type: 'product',
        value,
        currency: CURRENCY,
        order_id: orderId,
      },
      orderId
    );
  });
}
