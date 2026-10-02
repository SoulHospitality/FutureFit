const prisma = require('../lib/prisma');
const cache = require('../lib/cache');

const SETTINGS_KEY = 'marketing';
const CACHE_KEY = 'marketing-settings';

const clientUrl = () =>
  (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');

const DEFAULT_ANNOUNCEMENTS = [
  { text: 'Free shipping on orders over EGP 2,000', link: '/shop' },
  { text: 'Cash on delivery across Egypt', link: '/shop' },
  { text: 'Pay by card or wallet — secured by Paymob', link: '/shop' },
  { text: '14-day easy returns on unworn pieces', link: '/returns' },
];

const defaults = () => ({
  tracking: {
    gtmId: '',
    ga4Id: '',
    googleAdsId: '',
    googleAdsPurchaseLabel: '',
    // Pixel that was previously baked into the storefront build
    metaPixelId: process.env.META_PIXEL_ID || '484242591335280',
    metaCapiToken: '',
    metaTestEventCode: '',
    tiktokPixelId: '',
    clarityId: '',
  },
  seo: {
    siteUrl: '',
    siteTitle: 'FutureFit — Setting Trends With Every Stitch',
    titleSuffix: ' | FutureFit',
    metaDescription:
      'FutureFit — Setting trends with every stitch. Premium underwear and everyday essentials for men, women and kids, made in Egypt. Cash on delivery nationwide.',
    ogImage: '',
    allowIndexing: true,
    googleVerification: '',
    bingVerification: '',
    metaDomainVerification: '',
    verificationFiles: [],
  },
  campaigns: {
    announcements: DEFAULT_ANNOUNCEMENTS,
  },
});

const str = (v, max = 300) => String(v ?? '').trim().slice(0, max);

/** Field validators: return the cleaned value or throw a user-facing message. */
const ID_RULES = {
  gtmId: { re: /^GTM-[A-Z0-9]{4,12}$/, upper: true, label: 'Tag Manager ID (GTM-XXXXXXX)' },
  ga4Id: { re: /^G-[A-Z0-9]{4,16}$/, upper: true, label: 'GA4 Measurement ID (G-XXXXXXXXXX)' },
  googleAdsId: { re: /^AW-\d{6,14}$/, upper: true, label: 'Google Ads tag ID (AW-123456789)' },
  googleAdsPurchaseLabel: { re: /^[\w-]{4,40}$/, label: 'Google Ads purchase conversion label' },
  metaPixelId: { re: /^\d{8,20}$/, label: 'Meta Pixel ID (numbers only)' },
  metaTestEventCode: { re: /^[\w-]{3,40}$/, label: 'Meta test event code' },
  tiktokPixelId: { re: /^[A-Z0-9]{10,32}$/, upper: true, label: 'TikTok Pixel ID' },
  clarityId: { re: /^[a-z0-9]{6,20}$/, lower: true, label: 'Microsoft Clarity project ID' },
};

const cleanId = (key, value) => {
  let v = str(value, 60);
  if (!v) return '';
  const rule = ID_RULES[key];
  if (rule.upper) v = v.toUpperCase();
  if (rule.lower) v = v.toLowerCase();
  if (!rule.re.test(v)) {
    const err = new Error(`Invalid ${rule.label}`);
    err.status = 400;
    throw err;
  }
  return v;
};

const cleanUrl = (value) => {
  const v = str(value, 500);
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) {
    const err = new Error(`"${v}" must be a full URL starting with https://`);
    err.status = 400;
    throw err;
  }
  return v.replace(/\/+$/, '');
};

/** Accept either the bare code or the whole <meta ... content="..."> tag the platform shows. */
const cleanVerification = (value) => {
  const v = str(value, 400);
  const fromTag = v.match(/content=["']([^"']+)["']/i);
  return (fromTag ? fromTag[1] : v).trim().slice(0, 120);
};

const merge = (stored) => {
  const base = defaults();
  const s = stored && typeof stored === 'object' ? stored : {};
  return {
    tracking: { ...base.tracking, ...(s.tracking || {}) },
    seo: { ...base.seo, ...(s.seo || {}) },
    campaigns: { ...base.campaigns, ...(s.campaigns || {}) },
  };
};

const getSettings = async () => {
  const { data } = await cache.wrap(CACHE_KEY, 60_000, async () => {
    const row = await prisma.storeSetting.findUnique({ where: { key: SETTINGS_KEY } });
    return merge(row?.value);
  });
  return data;
};

const siteUrlFrom = (settings) => settings.seo.siteUrl || clientUrl();

/** Apply a partial update from the staff form; secrets are only replaced when sent. */
const saveSettings = async (body = {}) => {
  const current = await getSettings();
  const next = merge(current);

  if (body.tracking && typeof body.tracking === 'object') {
    const t = body.tracking;
    for (const key of Object.keys(ID_RULES)) {
      if (key in t) next.tracking[key] = cleanId(key, t[key]);
    }
    if (typeof t.metaCapiToken === 'string' && t.metaCapiToken.trim()) {
      next.tracking.metaCapiToken = t.metaCapiToken.trim().slice(0, 600);
    }
    if (t.clearMetaCapiToken) next.tracking.metaCapiToken = '';
  }

  if (body.seo && typeof body.seo === 'object') {
    const s = body.seo;
    if ('siteUrl' in s) next.seo.siteUrl = cleanUrl(s.siteUrl);
    if ('siteTitle' in s) next.seo.siteTitle = str(s.siteTitle, 120);
    if ('titleSuffix' in s) next.seo.titleSuffix = String(s.titleSuffix ?? '').slice(0, 60);
    if ('metaDescription' in s) next.seo.metaDescription = str(s.metaDescription, 320);
    if ('ogImage' in s) next.seo.ogImage = s.ogImage ? cleanUrl(s.ogImage) : '';
    if ('allowIndexing' in s) next.seo.allowIndexing = Boolean(s.allowIndexing);
    if ('googleVerification' in s) next.seo.googleVerification = cleanVerification(s.googleVerification);
    if ('bingVerification' in s) next.seo.bingVerification = cleanVerification(s.bingVerification);
    if ('metaDomainVerification' in s) {
      next.seo.metaDomainVerification = cleanVerification(s.metaDomainVerification);
    }
    if (Array.isArray(s.verificationFiles)) {
      next.seo.verificationFiles = s.verificationFiles
        .map((f) => ({ name: str(f?.name, 80), content: String(f?.content ?? '').slice(0, 4000) }))
        .filter((f) => f.name && f.content)
        .slice(0, 10)
        .map((f) => {
          if (!/^[\w.-]+\.(html|txt|xml)$/i.test(f.name) || /^index\.html$/i.test(f.name)) {
            const err = new Error(`Invalid verification file name "${f.name}"`);
            err.status = 400;
            throw err;
          }
          return f;
        });
    }
  }

  if (body.campaigns && typeof body.campaigns === 'object') {
    const c = body.campaigns;
    if (Array.isArray(c.announcements)) {
      next.campaigns.announcements = c.announcements
        .map((a) => ({ text: str(a?.text, 140), link: str(a?.link, 300) }))
        .filter((a) => a.text)
        .slice(0, 8);
    }
  }

  await prisma.storeSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: next },
    create: { key: SETTINGS_KEY, value: next },
  });
  cache.invalidate(CACHE_KEY);
  cache.invalidate('marketing-sitemap');
  cache.invalidate('marketing-feed');
  return next;
};

/** Safe for the storefront: no tokens, no verification file bodies. */
const publicView = (settings) => {
  const { metaCapiToken, ...tracking } = settings.tracking;
  const { verificationFiles, ...seo } = settings.seo;
  return {
    tracking,
    seo: { ...seo, siteUrl: siteUrlFrom(settings) },
    campaigns: settings.campaigns,
  };
};

/** Staff view: everything except the raw token. */
const adminView = (settings) => {
  const { metaCapiToken, ...tracking } = settings.tracking;
  return {
    ...settings,
    tracking: { ...tracking, metaCapiTokenSet: Boolean(metaCapiToken) },
    resolvedSiteUrl: siteUrlFrom(settings),
  };
};

module.exports = {
  getSettings,
  saveSettings,
  publicView,
  adminView,
  siteUrlFrom,
  clientUrl,
};
