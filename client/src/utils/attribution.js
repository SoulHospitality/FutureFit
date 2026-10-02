/** Remembers which campaign / ad brought the shopper in, so orders can be credited to it. */

const KEY = 'ff_attribution';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'ttclid'];

let referrerChecked = false;

const readCookie = (name) => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
};

const externalReferrer = () => {
  try {
    if (!document.referrer) return '';
    const ref = new URL(document.referrer);
    return ref.hostname === window.location.hostname ? '' : document.referrer;
  } catch {
    return '';
  }
};

/** Last non-direct touch wins (same as Shopify's "last click" model). */
export function captureAttribution() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const touch = {};
  PARAMS.forEach((p) => {
    const v = params.get(p);
    if (v) touch[p] = v.slice(0, 300);
  });

  const ref = referrerChecked ? '' : externalReferrer();
  referrerChecked = true;
  if (!Object.keys(touch).length && !ref) return;

  touch.referrer = ref;
  touch.landingUrl = window.location.href.slice(0, 500);
  touch.capturedAt = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(touch));
  } catch {
    /* ignore */
  }
}

export function getAttribution() {
  if (typeof window === 'undefined') return undefined;
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY)) || {};
    if (stored.capturedAt && Date.now() - new Date(stored.capturedAt).getTime() > MAX_AGE_MS) stored = {};
  } catch {
    stored = {};
  }
  const fbp = readCookie('_fbp');
  let fbc = readCookie('_fbc');
  if (!fbc && stored.fbclid) {
    fbc = `fb.1.${new Date(stored.capturedAt || Date.now()).getTime()}.${stored.fbclid}`;
  }
  const out = { ...stored, ...(fbp ? { fbp } : {}), ...(fbc ? { fbc } : {}) };
  return Object.keys(out).length ? out : undefined;
}
