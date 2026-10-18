const prisma = require('../lib/prisma');
const cache = require('../lib/cache');

const SETTINGS_KEY = 'website';
const CACHE_KEY = 'website-content';

const defaults = () => ({
  wording: {
    home: {
      heroEyebrow: 'FutureFit · From Cairo',
      heroFallbackTitle: 'Setting trends with every stitch.',
      heroFallbackBody:
        'Classic cuts. Modern presence. Essentials made to move with you — from Cairo streets to every occasion.',
      heroCta: 'Shop all',
      departmentsEyebrow: 'Shop by department',
      departmentsTitle: 'The best way to shop',
      departmentsTitleEm: 'the essentials you love.',
      departmentsLinkLabel: 'Shop all',
      bestSellersEyebrow: 'Top picks',
      bestSellersTitle: 'Best',
      bestSellersTitleEm: 'sellers',
      bestSellersBody: 'Customer favourites, selected by the house.',
      packsEyebrow: 'Keep exploring',
      packsTitle: 'Packs &',
      packsTitleEm: 'bundles',
      packsBody: 'Stock up on the pieces you wear most.',
      packsLinkLabel: 'Shop all',
      editorialEyebrow: 'Fabric & fit',
      editorialTitle: 'Soft hand. Clean lines.',
      editorialTitleEm: 'All-day hold.',
      editorialBody:
        'Considered fabrics and precise cuts — underwear and essentials made to stay comfortable from morning through late.',
      editorialCta: 'Shop the essentials',
      servicesEyebrow: 'Why FutureFit',
      servicesTitle: 'Shopping made',
      servicesTitleEm: 'effortless.',
      newsletterEyebrow: 'Newsletter',
      newsletterTitle: 'First to know.',
      newsletterTitleEm: 'First to wear.',
      newsletterBody: 'New drops and restocks — straight to your inbox. No spam, ever.',
      newsletterCta: 'Subscribe',
    },
    shop: {
      allTitle: 'The collection',
      allBody: 'Underwear, undershirts, and everyday essentials for every wardrobe.',
      emptyMessage: 'No products match these filters.',
      resultsBody: 'Showing matches across the catalog.',
    },
  },
  policies: {
    privacy: {
      title: 'Privacy',
      body: 'We collect your name, email, phone, and address to fulfill orders. We do not sell your data.\n\nWe use cookies and similar technologies from analytics and advertising partners (such as Google, Meta and TikTok) to understand how the store is used and to measure our ads.',
    },
    terms: {
      title: 'Terms',
      body: 'By shopping at FutureFit you agree to our checkout terms, product availability, and delivery timelines.',
    },
    returns: {
      title: 'Returns',
      body: 'Unworn items may be returned within 14 days. Contact Ops via your order if there is a delivery issue.',
    },
  },
  contacts: {
    eyebrow: 'Contact',
    title: 'Let’s talk',
    body: 'Questions about sizing, delivery, or an order? Reach out — we confirm every order within 12 hours.',
    email: '',
    phoneDisplay: '',
    phoneDigits: '',
    whatsappUrl: '',
    facebookUrl: 'https://www.facebook.com/FutureFit.eg',
    facebookHandle: '@FutureFit.eg',
    deliveryTitle: 'Delivery',
    deliveryBody: 'Orders ship in 2–3 business days after confirmation. Free shipping over EGP 2,000.',
    returnsTitle: 'Returns',
    returnsBody: 'Unworn items can be returned within 14 days.',
    ctaLabel: 'Shop collection',
  },
});

const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);

const mergeDeep = (base, patch) => {
  if (!patch || typeof patch !== 'object') return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object' && base[k]) {
      out[k] = mergeDeep(base[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
};

const merge = (stored) => mergeDeep(defaults(), stored && typeof stored === 'object' ? stored : {});

const getWebsiteContent = async () => {
  const { data } = await cache.wrap(CACHE_KEY, 60_000, async () => {
    const row = await prisma.storeSetting.findUnique({ where: { key: SETTINGS_KEY } });
    return merge(row?.value);
  });
  return data;
};

const cleanWordingHome = (h = {}) => {
  const keys = Object.keys(defaults().wording.home);
  const out = {};
  for (const key of keys) {
    if (key in h) out[key] = str(h[key], key.includes('Body') || key.includes('body') ? 600 : 160);
  }
  return out;
};

const cleanWordingShop = (s = {}) => {
  const keys = Object.keys(defaults().wording.shop);
  const out = {};
  for (const key of keys) {
    if (key in s) out[key] = str(s[key], 400);
  }
  return out;
};

const cleanPolicy = (p = {}) => ({
  title: str(p.title, 80),
  body: str(p.body, 8000),
});

const cleanContacts = (c = {}) => ({
  eyebrow: str(c.eyebrow, 40),
  title: str(c.title, 80),
  body: str(c.body, 600),
  email: str(c.email, 120),
  phoneDisplay: str(c.phoneDisplay, 40),
  phoneDigits: str(c.phoneDigits, 20).replace(/\D/g, ''),
  whatsappUrl: str(c.whatsappUrl, 300),
  facebookUrl: str(c.facebookUrl, 300),
  facebookHandle: str(c.facebookHandle, 80),
  deliveryTitle: str(c.deliveryTitle, 80),
  deliveryBody: str(c.deliveryBody, 600),
  returnsTitle: str(c.returnsTitle, 80),
  returnsBody: str(c.returnsBody, 600),
  ctaLabel: str(c.ctaLabel, 60),
});

const saveWebsiteContent = async (body = {}) => {
  const current = await getWebsiteContent();
  const next = merge(current);

  if (body.wording && typeof body.wording === 'object') {
    if (body.wording.home) {
      next.wording.home = { ...next.wording.home, ...cleanWordingHome(body.wording.home) };
    }
    if (body.wording.shop) {
      next.wording.shop = { ...next.wording.shop, ...cleanWordingShop(body.wording.shop) };
    }
  }

  if (body.policies && typeof body.policies === 'object') {
    for (const key of ['privacy', 'terms', 'returns']) {
      if (body.policies[key]) {
        next.policies[key] = {
          ...next.policies[key],
          ...cleanPolicy(body.policies[key]),
        };
      }
    }
  }

  if (body.contacts && typeof body.contacts === 'object') {
    next.contacts = { ...next.contacts, ...cleanContacts(body.contacts) };
  }

  await prisma.storeSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: next },
    create: { key: SETTINGS_KEY, value: next },
  });
  cache.invalidate(CACHE_KEY);
  return next;
};

module.exports = {
  defaults,
  getWebsiteContent,
  saveWebsiteContent,
};
