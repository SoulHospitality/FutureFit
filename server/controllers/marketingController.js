const crypto = require('crypto');
const prisma = require('../lib/prisma');
const cache = require('../lib/cache');
const {
  getSettings,
  saveSettings,
  publicView,
  adminView,
  siteUrlFrom,
} = require('../utils/marketing');

const AUDIENCES = ['men', 'women', 'kids'];

const xml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const sendError = (res, err) =>
  res.status(err.status || 500).json({ message: err.message || 'Something went wrong' });

// ── Settings ────────────────────────────────────────────────────────────────

const getPublicConfig = async (_req, res) => {
  try {
    const settings = await getSettings();
    res.set('Cache-Control', 'public, max-age=60');
    res.json(publicView(settings));
  } catch (err) {
    sendError(res, err);
  }
};

const getAdminSettings = async (_req, res) => {
  try {
    res.json(adminView(await getSettings()));
  } catch (err) {
    sendError(res, err);
  }
};

const updateSettings = async (req, res) => {
  try {
    const saved = await saveSettings(req.body || {});
    res.json(adminView(saved));
  } catch (err) {
    sendError(res, err);
  }
};

/** Sends a PageView to Meta's Test Events tab so staff can confirm the access token works. */
const testMetaConnection = async (_req, res) => {
  try {
    const { tracking } = await getSettings();
    if (!tracking.metaPixelId || !tracking.metaCapiToken) {
      return res.status(400).json({ message: 'Add your Pixel ID and Conversions API token first' });
    }
    if (!tracking.metaTestEventCode) {
      return res
        .status(400)
        .json({ message: 'Add a test event code (Events Manager → Test events) to run a test' });
    }
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${tracking.metaPixelId}/events?access_token=${encodeURIComponent(tracking.metaCapiToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_event_code: tracking.metaTestEventCode,
          data: [
            {
              event_name: 'PageView',
              event_time: Math.floor(Date.now() / 1000),
              event_id: crypto.randomUUID(),
              action_source: 'website',
              user_data: { client_user_agent: 'FutureFit staff test', external_id: ['staff-test'] },
            },
          ],
        }),
        signal: AbortSignal.timeout(8000),
      }
    );
    const json = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(400).json({ message: json?.error?.message || `Meta returned ${r.status}` });
    res.json({ ok: true, eventsReceived: json.events_received });
  } catch (err) {
    sendError(res, err);
  }
};

// ── Campaign performance ────────────────────────────────────────────────────

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const channelOf = (a) => {
  if (!a || typeof a !== 'object') return { source: 'Not tracked', medium: '—', campaign: '—' };
  const ref = hostOf(a.referrer);
  const source =
    a.utm_source ||
    (a.gclid ? 'google' : a.fbclid ? 'facebook' : a.ttclid ? 'tiktok' : ref || 'direct');
  const medium =
    a.utm_medium || (a.gclid || a.fbclid || a.ttclid ? 'paid' : ref ? 'referral' : '(none)');
  return { source: String(source).toLowerCase(), medium: String(medium).toLowerCase(), campaign: a.utm_campaign || '—' };
};

const campaignReport = async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * 86_400_000);
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: since }, status: { not: 'canceled' } },
      select: { totalPrice: true, attribution: true, couponCode: true },
    });

    const rows = new Map();
    const sources = new Map();
    let revenue = 0;
    let tracked = 0;
    for (const o of orders) {
      const value = Number(o.totalPrice) || 0;
      revenue += value;
      const ch = channelOf(o.attribution);
      if (ch.source !== 'Not tracked') tracked += 1;
      const key = `${ch.source}|${ch.medium}|${ch.campaign}`;
      const row = rows.get(key) || { ...ch, orders: 0, revenue: 0, coupons: new Set() };
      row.orders += 1;
      row.revenue += value;
      if (o.couponCode) row.coupons.add(o.couponCode);
      rows.set(key, row);
      const s = sources.get(ch.source) || { source: ch.source, orders: 0, revenue: 0 };
      s.orders += 1;
      s.revenue += value;
      sources.set(ch.source, s);
    }

    res.json({
      days,
      totals: { orders: orders.length, revenue, tracked },
      sources: [...sources.values()].sort((a, b) => b.revenue - a.revenue),
      campaigns: [...rows.values()]
        .map((r) => ({ ...r, coupons: [...r.coupons] }))
        .sort((a, b) => b.revenue - a.revenue),
    });
  } catch (err) {
    sendError(res, err);
  }
};

// ── SEO files ───────────────────────────────────────────────────────────────

const sitemap = async (_req, res) => {
  try {
    const { data } = await cache.wrap('marketing-sitemap', 10 * 60_000, async () => {
      const settings = await getSettings();
      const base = siteUrlFrom(settings);
      const [products, categories] = await Promise.all([
        prisma.product.findMany({
          where: { status: 'active' },
          select: { id: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.category.findMany({
          where: { parentId: { not: null } },
          select: { slug: true, audience: true, updatedAt: true },
        }),
      ]);

      const urls = [
        { loc: '/', priority: '1.0', changefreq: 'daily' },
        { loc: '/shop', priority: '0.9', changefreq: 'daily' },
        ...AUDIENCES.map((a) => ({ loc: `/shop?audience=${a}`, priority: '0.8', changefreq: 'daily' })),
        ...categories.map((c) => ({
          loc: `/shop?audience=${c.audience}&category=${c.slug}`,
          lastmod: c.updatedAt,
          priority: '0.7',
          changefreq: 'weekly',
        })),
        ...products.map((p) => ({
          loc: `/product/${p.id}`,
          lastmod: p.updatedAt,
          priority: '0.8',
          changefreq: 'weekly',
        })),
        ...['/about', '/contact', '/returns', '/privacy', '/terms'].map((loc) => ({
          loc,
          priority: '0.3',
          changefreq: 'monthly',
        })),
      ];

      const body = urls
        .map(
          (u) =>
            `  <url><loc>${xml(base + u.loc)}</loc>${
              u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''
            }<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
        )
        .join('\n');
      return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
    });
    res.type('application/xml').set('Cache-Control', 'public, max-age=600').send(data);
  } catch (err) {
    res.status(500).type('text/plain').send(`Sitemap error: ${err.message}`);
  }
};

const robots = async (_req, res) => {
  try {
    const settings = await getSettings();
    const base = siteUrlFrom(settings);
    const lines = settings.seo.allowIndexing
      ? [
          'User-agent: *',
          'Allow: /',
          'Disallow: /staff',
          'Disallow: /checkout',
          'Disallow: /cart',
          'Disallow: /account',
          'Disallow: /order',
          'Disallow: /login',
          'Disallow: /signup',
          'Disallow: /wishlist',
          '',
          `Sitemap: ${base}/sitemap.xml`,
        ]
      : ['User-agent: *', 'Disallow: /'];
    res.type('text/plain').set('Cache-Control', 'public, max-age=600').send(`${lines.join('\n')}\n`);
  } catch (err) {
    res.status(500).type('text/plain').send(`robots error: ${err.message}`);
  }
};

/** Serves platform verification files (Google, Bing, Meta …) at the site root via a Vercel rewrite. */
const verificationFile = async (req, res) => {
  try {
    const name = String(req.params.name || '');
    const { seo } = await getSettings();
    const file = (seo.verificationFiles || []).find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (!file) return res.status(404).type('text/plain').send('Not found');
    const type = name.endsWith('.xml') ? 'application/xml' : name.endsWith('.txt') ? 'text/plain' : 'text/html';
    res.type(type).send(file.content);
  } catch (err) {
    res.status(500).type('text/plain').send(err.message);
  }
};

// ── Product feed (Google Merchant Center + Meta catalog) ────────────────────

const absoluteImage = (path, base) => {
  if (!path) return '';
  const drive =
    path.match(/\/file\/d\/([^/?&#]+)/)?.[1] ||
    path.match(/lh3\.googleusercontent\.com\/d\/([^?=&#]+)/)?.[1] ||
    (/drive\.google\.com/.test(path) ? path.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] : null);
  if (drive) return `https://lh3.googleusercontent.com/d/${drive}=w1200`;
  if (/^https?:\/\//i.test(path)) {
    return path.includes('res.cloudinary.com') && !path.includes('/upload/f_')
      ? path.replace('/upload/', '/upload/f_jpg,q_auto,w_1200/')
      : path;
  }
  const local = path.replace(/\/images\/products\/([^/?#]+)\.png$/i, '/images/products/$1.webp');
  return `${base}${local.startsWith('/') ? '' : '/'}${local}`;
};

const plain = (text, max = 4900) =>
  String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const GENDER = { men: 'male', women: 'female', kids: 'unisex' };

const productFeed = async (_req, res) => {
  try {
    const { data } = await cache.wrap('marketing-feed', 10 * 60_000, async () => {
      const settings = await getSettings();
      const base = siteUrlFrom(settings);
      const products = await prisma.product.findMany({
        where: { status: 'active' },
        include: {
          sizeStocks: { select: { stock: true } },
          category: { select: { name: true, parent: { select: { name: true } } } },
        },
        orderBy: { shopSortAll: 'asc' },
      });

      const items = products
        .filter((p) => p.photos?.length)
        .map((p) => {
          const stock = p.sizeStocks?.length
            ? p.sizeStocks.reduce((s, r) => s + (Number(r.stock) || 0), 0)
            : Number(p.stock) || 0;
          const onSale = p.isSaleActive && p.salePrice != null && Number(p.salePrice) < Number(p.price);
          const images = p.photos.map((ph) => absoluteImage(ph, base)).filter(Boolean);
          const type = [p.category?.parent?.name, p.category?.name].filter(Boolean).join(' > ');
          return [
            '    <item>',
            `      <g:id>${xml(p.id)}</g:id>`,
            `      <g:title>${xml(plain(p.name, 150))}</g:title>`,
            `      <g:description>${xml(plain(p.description) || plain(p.name))}</g:description>`,
            `      <g:link>${xml(`${base}/product/${p.id}`)}</g:link>`,
            `      <g:image_link>${xml(images[0])}</g:image_link>`,
            ...images.slice(1, 10).map((img) => `      <g:additional_image_link>${xml(img)}</g:additional_image_link>`),
            `      <g:availability>${stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>`,
            `      <g:price>${Number(p.price).toFixed(2)} EGP</g:price>`,
            onSale ? `      <g:sale_price>${Number(p.salePrice).toFixed(2)} EGP</g:sale_price>` : null,
            '      <g:brand>FutureFit</g:brand>',
            '      <g:condition>new</g:condition>',
            '      <g:identifier_exists>no</g:identifier_exists>',
            '      <g:google_product_category>213</g:google_product_category>',
            type ? `      <g:product_type>${xml(type)}</g:product_type>` : null,
            `      <g:gender>${GENDER[p.audience] || 'unisex'}</g:gender>`,
            `      <g:age_group>${p.audience === 'kids' ? 'kids' : 'adult'}</g:age_group>`,
            p.colors?.length ? `      <g:color>${xml(p.colors.slice(0, 3).join('/'))}</g:color>` : null,
            '    </item>',
          ]
            .filter(Boolean)
            .join('\n');
        })
        .join('\n');

      return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xml(settings.seo.siteTitle || 'FutureFit')}</title>
    <link>${xml(base)}</link>
    <description>${xml(settings.seo.metaDescription || 'FutureFit products')}</description>
${items}
  </channel>
</rss>
`;
    });
    res.type('application/xml').set('Cache-Control', 'public, max-age=600').send(data);
  } catch (err) {
    res.status(500).type('text/plain').send(`Feed error: ${err.message}`);
  }
};

module.exports = {
  getPublicConfig,
  getAdminSettings,
  updateSettings,
  testMetaConnection,
  campaignReport,
  sitemap,
  robots,
  verificationFile,
  productFeed,
};
