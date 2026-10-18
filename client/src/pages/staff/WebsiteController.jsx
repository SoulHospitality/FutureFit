import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, NavLink, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  Home,
  Images,
  LayoutGrid,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor,
  Phone,
  RefreshCw,
  Ruler,
  Save,
  ScrollText,
  Smartphone,
  Megaphone,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { defaultStaffPage } from '../../utils/permissions';
import api from '../../api/axios';
import DragSortList from '../../components/staff/DragSortList';
import { getImageUrl, asArray } from '../../utils/helpers';
import { readWebsiteDraft, writeWebsiteDraft } from '../../utils/websiteContent';
import StaffHomepage from './Homepage';
import StaffSlides from './Slides';
import StaffShopControl from './ShopControl';

const SECTIONS = [
  {
    path: 'homepage',
    label: 'Homepage',
    icon: Home,
    preview: '/',
    hint: 'Product rails and homepage wording',
  },
  {
    path: 'slideshows',
    label: 'Slideshows',
    icon: Images,
    preview: '/',
    hint: 'Separate PC (16:9) and phone (9:16) hero slideshows',
  },
  {
    path: 'shop',
    label: 'Shop controller',
    icon: LayoutGrid,
    preview: '/shop',
    hint: 'Shop order and items-list wording',
  },
  {
    path: 'size-charts',
    label: 'Size charts',
    icon: Ruler,
    preview: '/shop',
    hint: 'Upload a size-chart photo per subcategory',
  },
  {
    path: 'policies',
    label: 'Policies',
    icon: ScrollText,
    preview: '/returns',
    hint: 'Privacy, terms, and returns copy',
  },
  {
    path: 'contacts',
    label: 'Contacts',
    icon: Phone,
    preview: '/contact',
    hint: 'Contact page details and channels',
  },
  {
    path: 'announcements',
    label: 'Announcement bar',
    icon: Megaphone,
    preview: '/',
    hint: 'Top-of-site announcement messages',
  },
];

const HOME_FIELDS = [
  { key: 'heroEyebrow', label: 'Hero eyebrow' },
  { key: 'heroFallbackTitle', label: 'Hero fallback title' },
  { key: 'heroFallbackBody', label: 'Hero fallback body', multiline: true },
  { key: 'heroCta', label: 'Hero CTA' },
  { key: 'departmentsEyebrow', label: 'Departments eyebrow' },
  { key: 'departmentsTitle', label: 'Departments title' },
  { key: 'departmentsTitleEm', label: 'Departments title emphasis' },
  { key: 'departmentsLinkLabel', label: 'Departments link label' },
  { key: 'bestSellersEyebrow', label: 'Best sellers eyebrow' },
  { key: 'bestSellersTitle', label: 'Best sellers title' },
  { key: 'bestSellersTitleEm', label: 'Best sellers title emphasis' },
  { key: 'bestSellersBody', label: 'Best sellers body', multiline: true },
  { key: 'packsEyebrow', label: 'Packs eyebrow' },
  { key: 'packsTitle', label: 'Packs title' },
  { key: 'packsTitleEm', label: 'Packs title emphasis' },
  { key: 'packsBody', label: 'Packs body', multiline: true },
  { key: 'editorialEyebrow', label: 'Editorial eyebrow' },
  { key: 'editorialTitle', label: 'Editorial title' },
  { key: 'editorialTitleEm', label: 'Editorial title emphasis' },
  { key: 'editorialBody', label: 'Editorial body', multiline: true },
  { key: 'editorialCta', label: 'Editorial CTA' },
  { key: 'servicesEyebrow', label: 'Services eyebrow' },
  { key: 'servicesTitle', label: 'Services title' },
  { key: 'servicesTitleEm', label: 'Services title emphasis' },
  { key: 'newsletterEyebrow', label: 'Newsletter eyebrow' },
  { key: 'newsletterTitle', label: 'Newsletter title' },
  { key: 'newsletterTitleEm', label: 'Newsletter title emphasis' },
  { key: 'newsletterBody', label: 'Newsletter body', multiline: true },
  { key: 'newsletterCta', label: 'Newsletter CTA' },
];

const SHOP_FIELDS = [
  { key: 'allTitle', label: 'Shop all title' },
  { key: 'allBody', label: 'Shop all body', multiline: true },
  { key: 'resultsBody', label: 'Search results body' },
  { key: 'emptyMessage', label: 'Empty results message' },
];

const POLICY_KEYS = [
  { key: 'privacy', label: 'Privacy', preview: '/privacy' },
  { key: 'terms', label: 'Terms', preview: '/terms' },
  { key: 'returns', label: 'Returns', preview: '/returns' },
];

function Field({ label, value, onChange, multiline }) {
  const cls = 'input mt-1 w-full';
  return (
    <label className="block">
      <span className="label">{label}</span>
      {multiline ? (
        <textarea className={`${cls} min-h-[88px]`} value={value || ''} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={cls} value={value || ''} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function withIds(list) {
  return (list || []).map((a, i) => ({
    ...a,
    id: a.id || `a-${i}-${a.text || ''}`,
  }));
}

/** Storefront at real device width, CSS-scaled to fit — soft canvas, no chrome clutter. */
function LivePreview({ path, refreshKey, device, zoom = 'fit', className = '' }) {
  const shellRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const frameW = device === 'mobile' ? 390 : 1280;
  const src = `${path}${path.includes('?') ? '&' : '?'}staffPreview=1&_=${refreshKey}`;

  useEffect(() => {
    const el = shellRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ w: Math.max(0, width - 32), h: Math.max(0, height - 24) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitScale = box.w > 0 ? box.w / frameW : 1;
  const scale =
    zoom === '100'
      ? 1
      : zoom === '75'
        ? 0.75
        : Math.min(1, Math.max(device === 'mobile' ? 0.78 : 0.5, fitScale));
  const frameH = box.h > 0 ? Math.max(720, Math.round(box.h / scale)) : 900;

  const pushDraft = (frame) => {
    const draft = readWebsiteDraft();
    if (!draft || !frame) return;
    try {
      frame.contentWindow?.postMessage({ type: 'ff-website-draft', draft }, window.location.origin);
    } catch {
      /* ignore */
    }
  };

  return (
    <div ref={shellRef} className={`relative min-h-0 flex-1 overflow-hidden ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.85),transparent_55%)]" />
      <div className="flex h-full items-start justify-center overflow-auto p-3 sm:p-4">
        {box.w > 0 ? (
          <div
            className="relative shrink-0"
            style={{
              width: frameW * scale,
              height: Math.min(box.h + 8, frameH * scale),
            }}
          >
            {device === 'mobile' ? (
              <div
                className="absolute inset-0 rounded-[2rem] bg-zinc-900 shadow-[0_25px_60px_-20px_rgba(9,9,11,0.45)]"
                style={{ width: frameW * scale, height: Math.min(box.h + 8, frameH * scale) }}
                aria-hidden
              />
            ) : (
              <div
                className="absolute inset-0 rounded-xl bg-white shadow-[0_25px_60px_-24px_rgba(9,9,11,0.35)] ring-1 ring-zinc-900/10"
                aria-hidden
              />
            )}
            <iframe
              key={`${refreshKey}-${path}-${device}`}
              data-ff-preview
              title="Store preview"
              src={src}
              className={`relative bg-white ${
                device === 'mobile'
                  ? 'rounded-[1.65rem] border-[5px] border-zinc-900'
                  : 'rounded-xl'
              }`}
              style={{
                width: frameW,
                height: frameH,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                display: 'block',
              }}
              onLoad={(e) => pushDraft(e.currentTarget)}
            />
          </div>
        ) : (
          <div className="grid h-full place-items-center text-sm text-zinc-400">Loading preview…</div>
        )}
      </div>
      <div className="pointer-events-none absolute bottom-3 end-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium tabular-nums text-zinc-500 shadow-sm ring-1 ring-zinc-200 backdrop-blur">
        {Math.round(scale * 100)}% · {device === 'mobile' ? 'Phone' : 'Desktop'}
      </div>
    </div>
  );
}

function SizeChartsPanel({ onChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .get('/categories')
      .then((r) => {
        const all = asArray(r.data);
        setRows(all.filter((c) => c.parentId).sort((a, b) => a.audience.localeCompare(b.audience) || a.sortOrder - b.sortOrder));
      })
      .catch(() => {
        setRows([]);
        toast.error('Could not load categories');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const upload = async (cat, file) => {
    if (!file) return;
    setUploadingId(cat.id);
    try {
      const reader = new FileReader();
      const dataUri = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data } = await api.post('/upload', {
        imageData: dataUri,
        folder: 'futurefit/size-charts',
        key: `size-chart-${cat.id}`,
      });
      await api.put(`/categories/${cat.id}`, { sizeChartUrl: data.url });
      toast.success(`Size chart saved for ${cat.name}`);
      load();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploadingId(null);
    }
  };

  const clear = async (cat) => {
    try {
      await api.put(`/categories/${cat.id}`, { sizeChartUrl: null });
      toast.success('Size chart removed');
      load();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove chart');
    }
  };

  if (loading) return <p className="text-sm text-zinc-400">Loading subcategories…</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500">
        Upload a size-chart photo for each subcategory. It appears on product pages in that category.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-400">No subcategories yet — create them under Categories first.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {rows.map((cat) => (
            <li key={cat.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="h-16 w-14 shrink-0 overflow-hidden rounded bg-zinc-100">
                {cat.sizeChartUrl ? (
                  <img
                    src={getImageUrl(cat.sizeChartUrl, { width: 120 })}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900">{cat.name}</p>
                <p className="text-xs capitalize text-zinc-500">
                  {cat.audience}
                  {cat.parent?.name ? ` · ${cat.parent.name}` : ''}
                </p>
              </div>
              <label className="btn-outline btn-sm cursor-pointer">
                {uploadingId === cat.id ? 'Uploading…' : cat.sizeChartUrl ? 'Replace' : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingId === cat.id}
                  onChange={(e) => upload(cat, e.target.files?.[0])}
                />
              </label>
              {cat.sizeChartUrl ? (
                <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => clear(cat)}>
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PoliciesPanel({ form, setForm, onSave, saving }) {
  const [tab, setTab] = useState('privacy');
  const policy = form.policies?.[tab] || { title: '', body: '' };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-zinc-200">
        {POLICY_KEYS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setTab(p.key)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === p.key ? 'border-b-2 border-zinc-900 text-zinc-900' : 'text-zinc-500'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <Field
        label="Title"
        value={policy.title}
        onChange={(v) =>
          setForm((f) => ({
            ...f,
            policies: { ...f.policies, [tab]: { ...f.policies[tab], title: v } },
          }))
        }
      />
      <Field
        label="Body"
        multiline
        value={policy.body}
        onChange={(v) =>
          setForm((f) => ({
            ...f,
            policies: { ...f.policies, [tab]: { ...f.policies[tab], body: v } },
          }))
        }
      />
      <button type="button" className="btn-wheat inline-flex items-center gap-1.5" disabled={saving} onClick={onSave}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save policies
      </button>
    </div>
  );
}

function ContactsPanel({ form, setForm, onSave, saving }) {
  const c = form.contacts || {};
  const set = (key, v) => setForm((f) => ({ ...f, contacts: { ...f.contacts, [key]: v } }));
  const fields = [
    ['eyebrow', 'Eyebrow'],
    ['title', 'Title'],
    ['body', 'Intro', true],
    ['email', 'Email'],
    ['phoneDisplay', 'Phone (display)'],
    ['phoneDigits', 'Phone digits (WhatsApp / tel)'],
    ['whatsappUrl', 'WhatsApp URL (optional override)'],
    ['facebookUrl', 'Facebook URL'],
    ['facebookHandle', 'Facebook handle'],
    ['deliveryTitle', 'Delivery card title'],
    ['deliveryBody', 'Delivery card body', true],
    ['returnsTitle', 'Returns card title'],
    ['returnsBody', 'Returns card body', true],
    ['ctaLabel', 'CTA label'],
  ];
  return (
    <div className="space-y-3">
      {fields.map(([key, label, multi]) => (
        <Field key={key} label={label} multiline={multi} value={c[key]} onChange={(v) => set(key, v)} />
      ))}
      <button type="button" className="btn-wheat inline-flex items-center gap-1.5" disabled={saving} onClick={onSave}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save contacts
      </button>
    </div>
  );
}

function AnnouncementsPanel({ onChanged }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/marketing/settings')
      .then((r) => setList(withIds(r.data?.campaigns?.announcements || [])))
      .catch(() => toast.error('Could not load announcements'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = list.map(({ text, link }) => ({ text, link }));
      const { data } = await api.put('/marketing/settings', {
        campaigns: { announcements: payload },
      });
      setList(withIds(data.campaigns?.announcements || payload));
      toast.success('Announcement bar saved');
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-zinc-400">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-zinc-500">Messages rotate in the top bar. Leave empty to hide the bar.</p>
        <button
          type="button"
          className="btn-outline btn-sm"
          disabled={list.length >= 8}
          onClick={() => setList([...list, { id: `new-${Date.now()}`, text: '', link: '/shop' }])}
        >
          Add message
        </button>
      </div>
      {list.length ? (
        <DragSortList
          items={list}
          onReorder={setList}
          selectable={false}
          itemLabel="announcement"
          className="overflow-clip rounded-xl border border-zinc-200"
          renderItem={(a) => (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                className="input flex-1"
                placeholder="Message"
                value={a.text}
                onChange={(e) =>
                  setList(list.map((x) => (x.id === a.id ? { ...x, text: e.target.value } : x)))
                }
              />
              <input
                className="input sm:w-44"
                placeholder="/shop"
                value={a.link || ''}
                onChange={(e) =>
                  setList(list.map((x) => (x.id === a.id ? { ...x, link: e.target.value } : x)))
                }
              />
              <button
                type="button"
                className="btn-ghost btn-sm text-red-600"
                onClick={() => setList(list.filter((x) => x.id !== a.id))}
              >
                Remove
              </button>
            </div>
          )}
        />
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400">
          No messages — the announcement bar is hidden.
        </p>
      )}
      <button type="button" className="btn-wheat inline-flex items-center gap-1.5" disabled={saving} onClick={save}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save announcements
      </button>
    </div>
  );
}

function HomeWordingPanel({ form, setForm, onSave, saving }) {
  const home = form.wording?.home || {};
  return (
    <div className="mt-8 space-y-3 border-t border-zinc-200 pt-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Homepage wording</h3>
        <p className="mt-0.5 text-xs text-zinc-500">Headlines and copy shown on the storefront home page.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {HOME_FIELDS.map((f) => (
          <div key={f.key} className={f.multiline ? 'sm:col-span-2' : ''}>
            <Field
              label={f.label}
              multiline={f.multiline}
              value={home[f.key]}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  wording: {
                    ...prev.wording,
                    home: { ...prev.wording.home, [f.key]: v },
                  },
                }))
              }
            />
          </div>
        ))}
      </div>
      <button type="button" className="btn-wheat inline-flex items-center gap-1.5" disabled={saving} onClick={onSave}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save homepage wording
      </button>
    </div>
  );
}

function ShopWordingPanel({ form, setForm, onSave, saving }) {
  const shop = form.wording?.shop || {};
  return (
    <div className="mt-8 space-y-3 border-t border-zinc-200 pt-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Items list wording</h3>
        <p className="mt-0.5 text-xs text-zinc-500">Titles and empty states on the shop / collection page.</p>
      </div>
      <div className="grid gap-3">
        {SHOP_FIELDS.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            multiline={f.multiline}
            value={shop[f.key]}
            onChange={(v) =>
              setForm((prev) => ({
                ...prev,
                wording: {
                  ...prev.wording,
                  shop: { ...prev.wording.shop, [f.key]: v },
                },
              }))
            }
          />
        ))}
      </div>
      <button type="button" className="btn-wheat inline-flex items-center gap-1.5" disabled={saving} onClick={onSave}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save shop wording
      </button>
    </div>
  );
}

export default function StaffWebsiteController() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [device, setDevice] = useState('desktop');
  const [mobileTab, setMobileTab] = useState('edit'); // edit | preview
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState('fit');
  const [policyPreview, setPolicyPreview] = useState('/returns');
  const draftTimer = useRef(null);
  const backTo = defaultStaffPage(user?.role);

  const activePath = pathname.replace(/^\/staff\/website\/?/, '').split('/')[0] || 'homepage';
  const section = SECTIONS.find((s) => s.path === activePath) || SECTIONS[0];

  const previewPath = useMemo(() => {
    if (section.path === 'policies') return policyPreview;
    return section.preview;
  }, [section, policyPreview]);

  const bumpPreview = useCallback(() => setPreviewKey((k) => k + 1), []);

  useEffect(() => {
    api
      .get('/website')
      .then((r) => setForm(r.data))
      .catch(() => toast.error('Could not load website content'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!form) return undefined;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      writeWebsiteDraft({ ...form, updatedAt: Date.now() });
    }, 250);
    return () => clearTimeout(draftTimer.current);
  }, [form]);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const saveContent = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const { data } = await api.put('/website', form);
      setForm(data);
      toast.success('Website content saved');
      bumpPreview();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (pathname === '/staff/website' || pathname === '/staff/website/') {
    return <Navigate to="/staff/website/homepage" replace />;
  }

  if (loading || !form) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  const panel = (() => {
    switch (section.path) {
      case 'homepage':
        return (
          <>
            <StaffHomepage embedded onChanged={bumpPreview} />
            <HomeWordingPanel form={form} setForm={setForm} onSave={saveContent} saving={saving} />
          </>
        );
      case 'slideshows':
        return <StaffSlides embedded onChanged={bumpPreview} />;
      case 'shop':
        return (
          <>
            <StaffShopControl embedded onChanged={bumpPreview} />
            <ShopWordingPanel form={form} setForm={setForm} onSave={saveContent} saving={saving} />
          </>
        );
      case 'size-charts':
        return <SizeChartsPanel onChanged={bumpPreview} />;
      case 'policies':
        return (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              {POLICY_KEYS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    policyPreview === p.preview ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
                  }`}
                  onClick={() => setPolicyPreview(p.preview)}
                >
                  Preview {p.label}
                </button>
              ))}
            </div>
            <PoliciesPanel form={form} setForm={setForm} onSave={saveContent} saving={saving} />
          </>
        );
      case 'contacts':
        return <ContactsPanel form={form} setForm={setForm} onSave={saveContent} saving={saving} />;
      case 'announcements':
        return <AnnouncementsPanel onChanged={bumpPreview} />;
      default:
        return null;
    }
  })();

  const ToolBtn = ({ active, onClick, children, title }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition ${
        active
          ? 'bg-zinc-900 text-white'
          : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-900'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-200/80 bg-white px-3 sm:px-4">
        <Link
          to={backTo}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">Admin</span>
        </Link>
        <div className="h-4 w-px bg-zinc-200" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-zinc-900">Website Controller</p>
        </div>

        {/* Mobile edit / preview switch */}
        <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 md:hidden">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              mobileTab === 'edit' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
            }`}
            onClick={() => setMobileTab('edit')}
          >
            Edit
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              mobileTab === 'preview' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
            }`}
            onClick={() => setMobileTab('preview')}
          >
            Preview
          </button>
        </div>

        <div className="hidden items-center gap-1.5 md:flex">
          <div className="inline-flex rounded-lg bg-zinc-100 p-0.5">
            <button
              type="button"
              title="Desktop"
              className={`grid h-7 w-8 place-items-center rounded-md ${
                device === 'desktop' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
              }`}
              onClick={() => setDevice('desktop')}
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Phone"
              className={`grid h-7 w-8 place-items-center rounded-md ${
                device === 'mobile' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
              }`}
              onClick={() => setDevice('mobile')}
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 text-[11px] font-semibold">
            {['fit', '75', '100'].map((z) => (
              <button
                key={z}
                type="button"
                className={`rounded-md px-2 py-1 ${
                  zoom === z ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
                }`}
                onClick={() => setZoom(z)}
              >
                {z === 'fit' ? 'Fit' : `${z}%`}
              </button>
            ))}
          </div>
          <ToolBtn onClick={bumpPreview} title="Refresh preview">
            <RefreshCw className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => setExpanded(true)} title="Fullscreen preview">
            <Maximize2 className="h-3.5 w-3.5" />
          </ToolBtn>
          <Link
            to={previewPath}
            target="_blank"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Store
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Section rail + editor */}
        <div
          className={`${
            mobileTab === 'edit' ? 'flex' : 'hidden'
          } w-full min-h-0 shrink-0 flex-col border-r border-zinc-200/80 bg-white md:flex md:w-[420px] xl:w-[440px]`}
        >
          <div className="flex min-h-0 flex-1">
            <nav className="flex w-14 shrink-0 flex-col gap-0.5 border-r border-zinc-100 bg-zinc-50/80 py-2 sm:w-[200px] sm:px-2">
              {SECTIONS.map((s) => (
                <NavLink
                  key={s.path}
                  to={`/staff/website/${s.path}`}
                  title={s.label}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-[13px] font-medium transition ${
                      isActive
                        ? 'bg-zinc-900 text-white shadow-sm'
                        : 'text-zinc-600 hover:bg-white hover:text-zinc-900'
                    }`
                  }
                >
                  <s.icon className="mx-auto h-4 w-4 shrink-0 sm:mx-0" strokeWidth={1.75} />
                  <span className="hidden truncate sm:inline">{s.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
              <div className="sticky top-0 z-10 border-b border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur">
                <p className="text-sm font-semibold text-zinc-900">{section.label}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-zinc-500">{section.hint}</p>
              </div>
              <div className="p-4">{panel}</div>
            </div>
          </div>
        </div>

        {/* Preview stage */}
        <div
          className={`${
            mobileTab === 'preview' ? 'flex' : 'hidden'
          } min-h-0 min-w-0 flex-1 flex-col md:flex`}
        >
          {!expanded ? (
            <LivePreview
              path={previewPath}
              refreshKey={previewKey}
              device={device}
              zoom={zoom}
              className="bg-[#e8e8ea]"
            />
          ) : null}

          {/* Mobile preview toolbar */}
          <div className="flex items-center justify-center gap-2 border-t border-zinc-200 bg-white px-3 py-2 md:hidden">
            <button
              type="button"
              className={`grid h-9 w-9 place-items-center rounded-lg ${
                device === 'desktop' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
              }`}
              onClick={() => setDevice('desktop')}
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={`grid h-9 w-9 place-items-center rounded-lg ${
                device === 'mobile' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
              }`}
              onClick={() => setDevice('mobile')}
            >
              <Smartphone className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-100 text-zinc-600"
              onClick={bumpPreview}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-100 text-zinc-600"
              onClick={() => setExpanded(true)}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="fixed inset-0 z-[90] flex flex-col bg-[#e8e8ea]">
          <div className="flex h-12 items-center justify-between gap-2 border-b border-zinc-200 bg-white px-4">
            <p className="text-sm font-semibold text-zinc-900">Preview</p>
            <div className="flex items-center gap-1.5">
              <div className="inline-flex rounded-lg bg-zinc-100 p-0.5">
                <button
                  type="button"
                  className={`grid h-8 w-9 place-items-center rounded-md ${
                    device === 'desktop' ? 'bg-white shadow-sm' : 'text-zinc-500'
                  }`}
                  onClick={() => setDevice('desktop')}
                >
                  <Monitor className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={`grid h-8 w-9 place-items-center rounded-md ${
                    device === 'mobile' ? 'bg-white shadow-sm' : 'text-zinc-500'
                  }`}
                  onClick={() => setDevice('mobile')}
                >
                  <Smartphone className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white"
                onClick={() => setExpanded(false)}
              >
                <Minimize2 className="h-3.5 w-3.5" />
                Close
              </button>
            </div>
          </div>
          <LivePreview
            path={previewPath}
            refreshKey={previewKey}
            device={device}
            zoom="fit"
            className="bg-[#e8e8ea]"
          />
        </div>
      ) : null}
    </div>
  );
}
