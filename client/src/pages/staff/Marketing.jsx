import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  BarChart3,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  Megaphone,
  Plus,
  Rss,
  Search,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react';
import api from '../../api/axios';
import BrandLoader from '../../components/ui/BrandLoader';
import DragSortList from '../../components/staff/DragSortList';
import { formatMoney } from '../../utils/helpers';
import { loadMarketingConfig } from '../../utils/marketingConfig';

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'tracking', label: 'Tracking & pixels', icon: Megaphone },
  { id: 'seo', label: 'SEO', icon: Search },
  { id: 'campaigns', label: 'Campaigns', icon: Link2 },
];

const UTM_SOURCES = ['facebook', 'instagram', 'tiktok', 'google', 'whatsapp', 'newsletter', 'influencer'];
const UTM_MEDIUMS = ['paid_social', 'cpc', 'social', 'email', 'sms', 'referral'];
const DESTINATIONS = [
  { label: 'Home', path: '/' },
  { label: 'Shop all', path: '/shop' },
  { label: 'Men', path: '/shop?audience=men' },
  { label: 'Women', path: '/shop?audience=women' },
  { label: 'Kids', path: '/shop?audience=kids' },
];

let rowId = 0;
const withIds = (list = []) => list.map((a) => ({ ...a, id: `a${(rowId += 1)}` }));
const stripIds = (list = []) =>
  list.map((row) => {
    const rest = { ...row };
    delete rest.id;
    return rest;
  });

const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied');
  } catch {
    toast.error('Copy failed');
  }
};

function Field({ label, hint, children, counter }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-zinc-900">{label}</span>
        {counter}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{hint}</p> : null}
    </label>
  );
}

function PlatformCard({ title, badge, connected, help, helpLabel = 'Open', children }) {
  return (
    <div className="sp-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          {badge ? <p className="mt-0.5 text-xs text-zinc-500">{badge}</p> : null}
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            connected ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
          }`}
        >
          {connected ? <Check className="h-3 w-3" /> : null}
          {connected ? 'Active' : 'Off'}
        </span>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
      {help ? (
        <a
          href={help}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900"
        >
          {helpLabel} <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

function CopyRow({ label, value, hint }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-700">{value}</code>
        <button
          type="button"
          className="rounded-lg border border-zinc-200 p-1.5 hover:bg-zinc-50"
          onClick={() => copy(value)}
          title="Copy"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-zinc-200 p-1.5 hover:bg-zinc-50"
          title="Open"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function Overview({ settings, report, days, setDays, loadingReport, goTo }) {
  const t = settings.tracking;
  const s = settings.seo;
  const checklist = [
    { label: 'Google Analytics 4', done: Boolean(t.ga4Id), tab: 'tracking' },
    { label: 'Google Ads purchase conversion', done: Boolean(t.googleAdsId && t.googleAdsPurchaseLabel), tab: 'tracking' },
    { label: 'Meta Pixel', done: Boolean(t.metaPixelId), tab: 'tracking' },
    { label: 'Meta Conversions API (server)', done: Boolean(t.metaCapiTokenSet), tab: 'tracking' },
    { label: 'TikTok Pixel', done: Boolean(t.tiktokPixelId), tab: 'tracking' },
    { label: 'Microsoft Clarity heatmaps', done: Boolean(t.clarityId), tab: 'tracking' },
    { label: 'Search Console verification', done: Boolean(s.googleVerification || s.verificationFiles?.length), tab: 'seo' },
    { label: 'Share image for links', done: Boolean(s.ogImage), tab: 'seo' },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const totals = report?.totals || { orders: 0, revenue: 0, tracked: 0 };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Where your orders come from</h2>
          <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-md px-3 py-1 text-xs font-medium ${
                  days === d ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            ['Orders', totals.orders],
            ['Revenue', formatMoney(totals.revenue)],
            ['With a known source', totals.orders ? `${Math.round((totals.tracked / totals.orders) * 100)}%` : '—'],
          ].map(([label, value]) => (
            <div key={label} className="sp-metric">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{value}</p>
            </div>
          ))}
        </div>

        <div className="sp-card overflow-hidden">
          {loadingReport ? (
            <div className="grid place-items-center py-10">
              <BrandLoader size="sm" label="Loading" />
            </div>
          ) : report?.campaigns?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left text-xs font-medium text-zinc-500">
                    <th className="px-4 py-2.5">Source</th>
                    <th className="px-4 py-2.5">Medium</th>
                    <th className="px-4 py-2.5">Campaign</th>
                    <th className="px-4 py-2.5 text-right">Orders</th>
                    <th className="px-4 py-2.5 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.campaigns.map((c) => (
                    <tr key={`${c.source}|${c.medium}|${c.campaign}`} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-2.5 font-medium capitalize text-zinc-900">{c.source}</td>
                      <td className="px-4 py-2.5 text-zinc-600">{c.medium}</td>
                      <td className="px-4 py-2.5 text-zinc-600">
                        {c.campaign}
                        {c.coupons?.length ? (
                          <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                            {c.coupons.slice(0, 3).map((code) => (
                              <span key={code} className="sp-tag">
                                {code}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{c.orders}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(c.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-zinc-500">No orders in this period yet.</p>
          )}
        </div>
        <p className="text-xs leading-relaxed text-zinc-500">
          Sources come from campaign links (UTM tags), ad click IDs (Google, Meta, TikTok) and the referring website.
          Orders placed before this page existed show as “Not tracked”. Build tagged links in the{' '}
          <button type="button" className="font-medium text-zinc-800 underline" onClick={() => goTo('campaigns')}>
            Campaigns
          </button>{' '}
          tab.
        </p>
      </div>

      <div className="sp-card h-fit p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Setup checklist</h2>
          <span className="text-xs tabular-nums text-zinc-500">
            {doneCount}/{checklist.length}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-zinc-900 transition-all"
            style={{ width: `${(doneCount / checklist.length) * 100}%` }}
          />
        </div>
        <ul className="mt-4 space-y-1">
          {checklist.map((c) => (
            <li key={c.label}>
              <button
                type="button"
                onClick={() => goTo(c.tab)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-zinc-50"
              >
                {c.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-zinc-300" />
                )}
                <span className={c.done ? 'text-zinc-500' : 'text-zinc-900'}>{c.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <Link
          to="/staff/promotions"
          className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          <Tag className="h-4 w-4" /> Discount codes
        </Link>
      </div>
    </div>
  );
}

export default function StaffMarketing() {
  const [tab, setTab] = useState('overview');
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [capiToken, setCapiToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [days, setDays] = useState(30);
  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [utm, setUtm] = useState({
    destination: '/shop',
    source: 'facebook',
    medium: 'paid_social',
    campaign: '',
    content: '',
  });

  const hydrate = (data) => {
    setSettings(data);
    setForm({
      tracking: { ...data.tracking },
      seo: { ...data.seo, verificationFiles: withIds(data.seo.verificationFiles || []) },
      campaigns: { announcements: withIds(data.campaigns?.announcements || []) },
    });
    setCapiToken('');
  };

  useEffect(() => {
    api
      .get('/marketing/settings')
      .then((r) => hydrate(r.data))
      .catch((err) => toast.error(err.response?.data?.message || 'Could not load marketing settings'));
  }, []);

  useEffect(() => {
    setLoadingReport(true);
    api
      .get(`/marketing/campaigns?days=${days}`)
      .then((r) => setReport(r.data))
      .catch(() => setReport(null))
      .finally(() => setLoadingReport(false));
  }, [days]);

  const siteUrl = (form?.seo.siteUrl || settings?.resolvedSiteUrl || window.location.origin).replace(/\/+$/, '');

  const dirty = useMemo(() => {
    if (!settings || !form) return false;
    const now = JSON.stringify({
      ...form,
      seo: { ...form.seo, verificationFiles: stripIds(form.seo.verificationFiles) },
      campaigns: { announcements: stripIds(form.campaigns.announcements) },
    });
    const was = JSON.stringify({
      tracking: settings.tracking,
      seo: settings.seo,
      campaigns: { announcements: settings.campaigns?.announcements || [] },
    });
    return now !== was || Boolean(capiToken);
  }, [settings, form, capiToken]);

  const setT = (key, value) => setForm((f) => ({ ...f, tracking: { ...f.tracking, [key]: value } }));
  const setS = (key, value) => setForm((f) => ({ ...f, seo: { ...f.seo, [key]: value } }));
  const setAnnouncements = (list) =>
    setForm((f) => ({ ...f, campaigns: { ...f.campaigns, announcements: list } }));
  const setFiles = (list) => setS('verificationFiles', list);

  const save = async (extra = {}) => {
    setSaving(true);
    try {
      const tracking = { ...form.tracking };
      delete tracking.metaCapiTokenSet;
      const { data } = await api.put('/marketing/settings', {
        tracking: { ...tracking, ...(capiToken ? { metaCapiToken: capiToken } : {}), ...extra },
        seo: { ...form.seo, verificationFiles: stripIds(form.seo.verificationFiles) },
        campaigns: { announcements: stripIds(form.campaigns.announcements) },
      });
      hydrate(data);
      loadMarketingConfig({ force: true });
      toast.success('Marketing settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const testMeta = async () => {
    setTesting(true);
    try {
      const { data } = await api.post('/marketing/test-meta');
      toast.success(`Meta received ${data.eventsReceived ?? 1} test event — check Events Manager → Test events`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const uploadShareImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('image', file);
      body.append('folder', 'futurefit/marketing');
      const { data } = await api.post('/upload', body);
      setS('ogImage', data.url);
      toast.success('Image uploaded — save to apply');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const utmUrl = useMemo(() => {
    const dest = utm.destination.trim() || '/';
    let url;
    try {
      url = new URL(/^https?:\/\//i.test(dest) ? dest : `${siteUrl}${dest.startsWith('/') ? '' : '/'}${dest}`);
    } catch {
      return '';
    }
    const slug = (v) => v.trim().toLowerCase().replace(/\s+/g, '_');
    if (utm.source) url.searchParams.set('utm_source', slug(utm.source));
    if (utm.medium) url.searchParams.set('utm_medium', slug(utm.medium));
    if (utm.campaign) url.searchParams.set('utm_campaign', slug(utm.campaign));
    if (utm.content) url.searchParams.set('utm_content', slug(utm.content));
    return url.toString();
  }, [utm, siteUrl]);

  if (!form) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <BrandLoader size="md" label="Loading" />
      </div>
    );
  }

  const t = form.tracking;
  const s = form.seo;
  const previewTitle = s.siteTitle || 'FutureFit';
  const descLen = (s.metaDescription || '').length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 text-white">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="page-title">Marketing</h1>
            <p className="page-subtitle">Ads pixels, SEO, campaign links and what’s driving sales</p>
          </div>
        </div>
        {tab !== 'overview' && (
          <button
            type="button"
            className="btn-wheat btn-sm"
            disabled={!dirty || saving}
            onClick={() => save()}
          >
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        )}
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-zinc-200">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                tab === item.id
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <Overview
          settings={settings}
          report={report}
          days={days}
          setDays={setDays}
          loadingReport={loadingReport}
          goTo={setTab}
        />
      )}

      {tab === 'tracking' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PlatformCard
            title="Google Analytics 4"
            badge="Visitors, traffic sources and full e-commerce funnel"
            connected={Boolean(t.ga4Id)}
            help="https://support.google.com/analytics/answer/9539598"
            helpLabel="Where to find the Measurement ID"
          >
            <Field label="Measurement ID" hint="Analytics → Admin → Data streams → your web stream. Starts with G-">
              <input className="input" placeholder="G-XXXXXXXXXX" value={t.ga4Id} onChange={(e) => setT('ga4Id', e.target.value)} />
            </Field>
          </PlatformCard>

          <PlatformCard
            title="Google Ads"
            badge="Purchase conversions + remarketing audiences"
            connected={Boolean(t.googleAdsId)}
            help="https://support.google.com/google-ads/answer/6095821"
            helpLabel="Set up a purchase conversion"
          >
            <Field
              label="Google tag ID"
              hint="Paste the whole send_to value (AW-123456789/AbCdEf) and it splits automatically."
            >
              <input
                className="input"
                placeholder="AW-123456789"
                value={t.googleAdsId}
                onChange={(e) => setT('googleAdsId', e.target.value)}
                onBlur={(e) => {
                  const m = e.target.value.trim().match(/^(AW-\d+)\/([\w-]+)$/i);
                  if (m) {
                    setT('googleAdsId', m[1].toUpperCase());
                    setT('googleAdsPurchaseLabel', m[2]);
                  }
                }}
              />
            </Field>
            <Field label="Purchase conversion label" hint="Goals → Conversions → your Purchase action → Tag setup → “Install the tag yourself”.">
              <input
                className="input"
                placeholder="AbC-D_efG-h12_34-567"
                value={t.googleAdsPurchaseLabel}
                onChange={(e) => setT('googleAdsPurchaseLabel', e.target.value)}
              />
            </Field>
          </PlatformCard>

          <PlatformCard
            title="Meta (Facebook & Instagram)"
            badge="Pixel in the browser + Conversions API from the server"
            connected={Boolean(t.metaPixelId)}
            help="https://business.facebook.com/events_manager2"
            helpLabel="Open Events Manager"
          >
            <Field label="Pixel ID" hint="Events Manager → Data sources → your pixel. Numbers only.">
              <input className="input" placeholder="123456789012345" value={t.metaPixelId} onChange={(e) => setT('metaPixelId', e.target.value)} />
            </Field>
            <Field
              label="Conversions API access token"
              hint="Recommended. Recovers purchases blocked by ad blockers / iOS. Events Manager → your pixel → Settings → Conversions API → Generate access token. Stored on the server only."
              counter={
                t.metaCapiTokenSet ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <Check className="h-3 w-3" /> Saved
                  </span>
                ) : null
              }
            >
              <input
                className="input"
                type="password"
                autoComplete="off"
                placeholder={t.metaCapiTokenSet ? '•••••••• (leave blank to keep)' : 'EAAG…'}
                value={capiToken}
                onChange={(e) => setCapiToken(e.target.value)}
              />
            </Field>
            <Field label="Test event code (optional)" hint="Events Manager → Test events. Remove it after testing so events count normally.">
              <input className="input" placeholder="TEST12345" value={t.metaTestEventCode} onChange={(e) => setT('metaTestEventCode', e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-outline btn-sm" onClick={testMeta} disabled={testing || dirty}>
                {testing ? 'Sending…' : 'Send test event'}
              </button>
              {t.metaCapiTokenSet && (
                <button
                  type="button"
                  className="btn-ghost btn-sm text-red-600"
                  onClick={() => save({ clearMetaCapiToken: true })}
                  disabled={saving}
                >
                  Remove token
                </button>
              )}
            </div>
          </PlatformCard>

          <PlatformCard
            title="TikTok"
            badge="TikTok Pixel for TikTok Ads"
            connected={Boolean(t.tiktokPixelId)}
            help="https://ads.tiktok.com/i18n/events_manager"
            helpLabel="Open TikTok Events Manager"
          >
            <Field label="Pixel ID" hint="Events Manager → Web events → your pixel → Settings.">
              <input className="input" placeholder="CXXXXXXXXXXXXXXXXXXX" value={t.tiktokPixelId} onChange={(e) => setT('tiktokPixelId', e.target.value)} />
            </Field>
          </PlatformCard>

          <PlatformCard
            title="Microsoft Clarity"
            badge="Free heatmaps and session recordings"
            connected={Boolean(t.clarityId)}
            help="https://clarity.microsoft.com"
            helpLabel="Create a free project"
          >
            <Field label="Project ID" hint="Clarity → Settings → Overview → Project ID.">
              <input className="input" placeholder="abcd1234ef" value={t.clarityId} onChange={(e) => setT('clarityId', e.target.value)} />
            </Field>
          </PlatformCard>

          <PlatformCard
            title="Google Tag Manager"
            badge="Advanced — for extra tags managed by an agency"
            connected={Boolean(t.gtmId)}
            help="https://tagmanager.google.com"
            helpLabel="Open Tag Manager"
          >
            <Field
              label="Container ID"
              hint="E-commerce events are pushed to the dataLayer. Don’t add GA4 or the Meta pixel inside GTM too, or they’ll count twice."
            >
              <input className="input" placeholder="GTM-XXXXXXX" value={t.gtmId} onChange={(e) => setT('gtmId', e.target.value)} />
            </Field>
          </PlatformCard>

          <div className="sp-card p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-zinc-900">Tracked automatically</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Every platform above receives the standard shopping events with product IDs, prices and EGP currency — no extra setup:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Page view', 'View product', 'Add to cart', 'Start checkout', 'Purchase (with order ID, no double counting)'].map((e) => (
                <span key={e} className="sp-tag">
                  {e}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'seo' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="sp-card p-5">
              <h3 className="text-sm font-semibold text-zinc-900">Search engine listing</h3>
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
                <p className="truncate text-xs text-zinc-600">{siteUrl.replace(/^https?:\/\//, '')}</p>
                <p className="mt-1 truncate text-lg text-[#1a0dab]">{previewTitle}</p>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{s.metaDescription}</p>
              </div>
              <div className="mt-5 space-y-4">
                <Field label="Homepage title" counter={<span className="text-xs tabular-nums text-zinc-400">{(s.siteTitle || '').length}/60</span>}>
                  <input className="input" value={s.siteTitle} onChange={(e) => setS('siteTitle', e.target.value)} />
                </Field>
                <Field
                  label="Meta description"
                  hint="Shown under your link on Google. Aim for 120–160 characters."
                  counter={
                    <span className={`text-xs tabular-nums ${descLen > 160 ? 'text-amber-600' : 'text-zinc-400'}`}>
                      {descLen}/160
                    </span>
                  }
                >
                  <textarea
                    className="input min-h-[90px]"
                    value={s.metaDescription}
                    onChange={(e) => setS('metaDescription', e.target.value)}
                  />
                </Field>
                <Field label="Title ending on other pages" hint={`Example: “Men Socks${s.titleSuffix || ''}”`}>
                  <input className="input" value={s.titleSuffix} onChange={(e) => setS('titleSuffix', e.target.value)} />
                </Field>
                <Field label="Store domain" hint="Your live website address, used in the sitemap, feed and canonical links.">
                  <input className="input" placeholder="https://futurefits.net" value={s.siteUrl} onChange={(e) => setS('siteUrl', e.target.value)} />
                </Field>
              </div>
            </div>

            <div className="sp-card p-5">
              <h3 className="text-sm font-semibold text-zinc-900">Social share image</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Shown when your store link is shared on WhatsApp, Facebook, etc. 1200 × 630 works best. Product pages use the product photo.
              </p>
              <div className="mt-4 flex flex-wrap items-start gap-4">
                <div className="grid aspect-[1200/630] w-56 place-items-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                  {s.ogImage ? (
                    <img src={s.ogImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Globe className="h-6 w-6 text-zinc-300" />
                  )}
                </div>
                <div className="flex min-w-[220px] flex-1 flex-col gap-2">
                  <label className="btn-outline btn-sm w-fit cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? 'Uploading…' : 'Upload image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => uploadShareImage(e.target.files?.[0])}
                    />
                  </label>
                  <input className="input" placeholder="or paste an image URL" value={s.ogImage} onChange={(e) => setS('ogImage', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="sp-card p-5">
              <h3 className="text-sm font-semibold text-zinc-900">Site verification</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Paste the code or the whole &lt;meta&gt; tag each platform gives you. If a platform can’t see the tag, use the HTML file option below instead.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Google Search Console">
                  <input className="input" value={s.googleVerification} onChange={(e) => setS('googleVerification', e.target.value)} />
                </Field>
                <Field label="Bing Webmaster">
                  <input className="input" value={s.bingVerification} onChange={(e) => setS('bingVerification', e.target.value)} />
                </Field>
                <Field label="Meta domain">
                  <input className="input" value={s.metaDomainVerification} onChange={(e) => setS('metaDomainVerification', e.target.value)} />
                </Field>
              </div>

              <div className="mt-5 border-t border-zinc-100 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-900">Verification files</p>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => setFiles([...s.verificationFiles, ...withIds([{ name: '', content: '' }])])}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add file
                  </button>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  E.g. Google’s “HTML file” method: name <code>google1234abcd.html</code> and paste the file’s contents. It’s served at {siteUrl}/&lt;name&gt;.
                </p>
                <div className="mt-3 space-y-2">
                  {s.verificationFiles.map((f, idx) => (
                    <div key={f.id} className="flex flex-wrap gap-2">
                      <input
                        className="input w-56"
                        placeholder="google1234abcd.html"
                        value={f.name}
                        onChange={(e) =>
                          setFiles(s.verificationFiles.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                        }
                      />
                      <input
                        className="input min-w-[200px] flex-1"
                        placeholder="File contents"
                        value={f.content}
                        onChange={(e) =>
                          setFiles(s.verificationFiles.map((x, i) => (i === idx ? { ...x, content: e.target.value } : x)))
                        }
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-zinc-200 px-2.5 hover:bg-zinc-50"
                        onClick={() => setFiles(s.verificationFiles.filter((_, i) => i !== idx))}
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4 text-zinc-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="sp-card p-5">
              <h3 className="text-sm font-semibold text-zinc-900">Search visibility</h3>
              <label className="mt-3 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-zinc-900"
                  checked={s.allowIndexing}
                  onChange={(e) => setS('allowIndexing', e.target.checked)}
                />
                <span>
                  <span className="text-sm font-medium text-zinc-900">Let search engines index the store</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    Turn off only while the store isn’t ready — it hides every page from Google.
                  </span>
                </span>
              </label>
            </div>
            <div className="sp-card space-y-4 p-5">
              <h3 className="text-sm font-semibold text-zinc-900">Built for you</h3>
              <CopyRow
                label="Sitemap"
                value={`${siteUrl}/sitemap.xml`}
                hint="Search Console → Sitemaps → paste this. Updates automatically with products."
              />
              <CopyRow label="Robots.txt" value={`${siteUrl}/robots.txt`} />
              <ul className="space-y-1.5 text-xs text-zinc-600">
                {[
                  'Unique title & description on every page',
                  'Product rich results (price, stock, rating)',
                  'Canonical links & social share tags',
                  'Checkout, cart and staff pages hidden from Google',
                ].map((x) => (
                  <li key={x} className="flex gap-2">
                    <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-600" /> {x}
                  </li>
                ))}
              </ul>
              <a
                href="https://search.google.com/search-console"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900"
              >
                Open Search Console <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {tab === 'campaigns' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="sp-card p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-zinc-900">Campaign link builder</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Use these links in ads, bios, WhatsApp blasts and influencer posts — orders from them show up in Overview by campaign.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Page">
                <input
                  className="input"
                  value={utm.destination}
                  onChange={(e) => setUtm((u) => ({ ...u, destination: e.target.value }))}
                  placeholder="/shop or a product link"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DESTINATIONS.map((d) => (
                    <button
                      key={d.path}
                      type="button"
                      onClick={() => setUtm((u) => ({ ...u, destination: d.path }))}
                      className={`rounded-full border px-2.5 py-0.5 text-xs ${
                        utm.destination === d.path ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Campaign name" hint="e.g. summer_sale, ramadan_2026">
                <input
                  className="input"
                  value={utm.campaign}
                  onChange={(e) => setUtm((u) => ({ ...u, campaign: e.target.value }))}
                  placeholder="summer_sale"
                />
              </Field>
              <Field label="Source">
                <input className="input" value={utm.source} onChange={(e) => setUtm((u) => ({ ...u, source: e.target.value }))} />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {UTM_SOURCES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setUtm((u) => ({ ...u, source: v }))}
                      className={`rounded-full border px-2.5 py-0.5 text-xs ${
                        utm.source === v ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Medium">
                <input className="input" value={utm.medium} onChange={(e) => setUtm((u) => ({ ...u, medium: e.target.value }))} />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {UTM_MEDIUMS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setUtm((u) => ({ ...u, medium: v }))}
                      className={`rounded-full border px-2.5 py-0.5 text-xs ${
                        utm.medium === v ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Ad / content (optional)" hint="Tell apart two ads in the same campaign, e.g. video_a, carousel">
                <input className="input" value={utm.content} onChange={(e) => setUtm((u) => ({ ...u, content: e.target.value }))} />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-zinc-50 p-3">
              <code className="min-w-0 flex-1 break-all text-xs text-zinc-700">{utmUrl || 'Enter a valid page'}</code>
              <button type="button" className="btn-wheat btn-sm" disabled={!utmUrl} onClick={() => copy(utmUrl)}>
                <Copy className="h-3.5 w-3.5" /> Copy link
              </button>
            </div>
          </div>

          <div className="sp-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Announcement bar</h3>
                <p className="mt-0.5 text-xs text-zinc-500">Rotating messages at the top of the store. Drag to reorder.</p>
              </div>
              <button
                type="button"
                className="btn-ghost btn-sm"
                disabled={form.campaigns.announcements.length >= 8}
                onClick={() => setAnnouncements([...form.campaigns.announcements, ...withIds([{ text: '', link: '/shop' }])])}
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            <div className="mt-4">
              {form.campaigns.announcements.length ? (
                <DragSortList
                  items={form.campaigns.announcements}
                  onReorder={setAnnouncements}
                  selectable={false}
                  itemLabel="message"
                  className="overflow-clip rounded-xl border border-zinc-200"
                  renderItem={(a) => (
                    <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                      <input
                        className="input min-w-[180px] flex-[2]"
                        placeholder="Free shipping over EGP 2,000"
                        value={a.text}
                        onChange={(e) =>
                          setAnnouncements(
                            form.campaigns.announcements.map((x) => (x.id === a.id ? { ...x, text: e.target.value } : x))
                          )
                        }
                      />
                      <input
                        className="input min-w-[120px] flex-1"
                        placeholder="/shop"
                        value={a.link}
                        onChange={(e) =>
                          setAnnouncements(
                            form.campaigns.announcements.map((x) => (x.id === a.id ? { ...x, link: e.target.value } : x))
                          )
                        }
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-zinc-200 px-2.5 hover:bg-zinc-50"
                        onClick={() => setAnnouncements(form.campaigns.announcements.filter((x) => x.id !== a.id))}
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4 text-zinc-500" />
                      </button>
                    </div>
                  )}
                />
              ) : (
                <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
                  No messages — the announcement bar is hidden.
                </p>
              )}
            </div>
          </div>

          <div className="sp-card space-y-4 p-5">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <Rss className="h-4 w-4" /> Product feed
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                One link that keeps your whole catalog (prices, sale prices, stock, photos) synced to shopping ads.
              </p>
            </div>
            <CopyRow label="Feed URL" value={`${siteUrl}/feeds/products.xml`} />
            <div className="space-y-2 text-xs leading-relaxed text-zinc-600">
              <p>
                <span className="font-medium text-zinc-900">Google Shopping:</span> Merchant Center → Products → Add products → “Add products from a file” → enter this URL, schedule daily.
              </p>
              <p>
                <span className="font-medium text-zinc-900">Facebook & Instagram Shop / dynamic ads:</span> Commerce Manager → Catalog → Data sources → Data feed → scheduled feed → paste this URL.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="https://merchants.google.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900">
                Merchant Center <ExternalLink className="h-3 w-3" />
              </a>
              <a href="https://business.facebook.com/commerce" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900">
                Commerce Manager <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <Link to="/staff/promotions" className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50">
              <Tag className="h-4 w-4" /> Create a discount code for a campaign
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
