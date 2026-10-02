import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getMarketingConfig, useMarketingConfig } from './marketingConfig';

const FALLBACK = {
  siteTitle: 'FutureFit — Setting Trends With Every Stitch',
  titleSuffix: ' | FutureFit',
  metaDescription: 'FutureFit — Setting trends with every stitch. Premium apparel from Egypt.',
  allowIndexing: true,
};

const upsert = (selector, create, attrs) => {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
};

const setMeta = (key, content, attr = 'name') => {
  const selector = `meta[${attr}="${key}"]`;
  if (!content) {
    document.head.querySelector(selector)?.remove();
    return;
  }
  upsert(selector, () => document.createElement('meta'), { [attr]: key, content });
};

const absolute = (url, base) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

/** Plain-text snippet for meta descriptions. */
export const snippet = (text, max = 158) => {
  const clean = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};

/**
 * Writes title, description, canonical, Open Graph / Twitter tags, robots and JSON-LD.
 * `title` is the page name only — the store suffix from Staff → Marketing is appended.
 */
export function applyPageMeta({ title, description, image, path, noindex, jsonLd, type = 'website' } = {}) {
  if (typeof document === 'undefined') return;
  const seo = { ...FALLBACK, ...(getMarketingConfig()?.seo || {}) };
  const base = (seo.siteUrl || window.location.origin).replace(/\/+$/, '');
  const fullTitle = title ? `${title}${seo.titleSuffix || ''}` : seo.siteTitle;
  const desc = snippet(description || seo.metaDescription, 300);
  const url = `${base}${path ?? window.location.pathname}`;
  const img = absolute(image || seo.ogImage || '/images/logo.png', base);

  document.title = fullTitle;
  setMeta('description', desc);
  upsert('link[rel="canonical"]', () => document.createElement('link'), { rel: 'canonical', href: url });
  setMeta('robots', noindex || !seo.allowIndexing ? 'noindex, nofollow' : 'index, follow');

  setMeta('og:site_name', 'FutureFit', 'property');
  setMeta('og:type', type, 'property');
  setMeta('og:title', fullTitle, 'property');
  setMeta('og:description', desc, 'property');
  setMeta('og:url', url, 'property');
  setMeta('og:image', img, 'property');
  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', fullTitle);
  setMeta('twitter:description', desc);
  setMeta('twitter:image', img);

  const existing = document.getElementById('ff-jsonld');
  if (jsonLd) {
    const el = existing || document.createElement('script');
    el.id = 'ff-jsonld';
    el.type = 'application/ld+json';
    el.textContent = JSON.stringify(jsonLd);
    if (!existing) document.head.appendChild(el);
  } else {
    existing?.remove();
  }
}

/** Site-wide verification tags (Google Search Console, Bing, Meta domain). */
export function applyVerificationTags(seo = {}) {
  setMeta('google-site-verification', seo.googleVerification);
  setMeta('msvalidate.01', seo.bingVerification);
  setMeta('facebook-domain-verification', seo.metaDomainVerification);
}

export function usePageMeta(meta) {
  const { pathname } = useLocation();
  const config = useMarketingConfig();
  const key = JSON.stringify(meta || {});
  useEffect(() => {
    applyPageMeta(JSON.parse(key));
  }, [key, pathname, config]);
}
