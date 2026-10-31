import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Gift, Pencil, Search, Ticket, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import { asArray, getImageUrl, formatMoney } from '../../utils/helpers';
import { OFFER_TYPES, OFFER_TYPE_KEYS, loadActiveOffers } from '../../utils/offers';

const TABS = [
  { id: 'offers', label: 'Offers', icon: Gift },
  { id: 'codes', label: 'Promo codes', icon: Ticket },
];

const OFFER_EXAMPLES = {
  buy1get1_free: 'Bag 500 + 300 → the 300 item is free',
  buy2get1_free: 'Bag 500 + 400 + 300 → the 300 item is free',
  buy1get1_half: 'Bag 500 + 300 → the 300 item is 150',
  buy2get1_half: 'Bag 500 + 400 + 300 → the 300 item is 150',
};

const EMPTY_OFFER = {
  name: '',
  type: 'buy1get1_free',
  appliesTo: 'all',
  productIds: [],
  isActive: true,
};

const EMPTY_CODE = { code: '', discountPercentage: 10, maxUses: '', isActive: true };

const errMsg = (err) => err.response?.data?.message || 'Something went wrong';

function ProductPicker({ products, selected, onChange }) {
  const [q, setQ] = useState('');
  const chosen = useMemo(() => new Set(selected), [selected]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => p.name.toLowerCase().includes(term));
  }, [products, q]);

  const toggle = (id) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const allFilteredOn = filtered.length > 0 && filtered.every((p) => chosen.has(p.id));
  const toggleFiltered = () => {
    const next = new Set(chosen);
    filtered.forEach((p) => (allFilteredOn ? next.delete(p.id) : next.add(p.id)));
    onChange([...next]);
  };

  return (
    <div className="border border-timber-200">
      <div className="flex items-center gap-2 border-b border-timber-100 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-timber-400" />
        <input
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm focus:ring-0"
          placeholder="Search products"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="btn-ghost btn-sm shrink-0" onClick={toggleFiltered}>
          {allFilteredOn ? 'Clear' : 'Select all'}
        </button>
      </div>
      <ul className="max-h-72 overflow-y-auto">
        {filtered.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-timber-50">
              <input type="checkbox" checked={chosen.has(p.id)} onChange={() => toggle(p.id)} />
              {p.photos?.[0] ? (
                <img
                  src={getImageUrl(p.photos[0], { width: 80 })}
                  alt=""
                  className="h-10 w-8 shrink-0 object-cover bg-timber-100"
                  loading="lazy"
                />
              ) : (
                <span className="h-10 w-8 shrink-0 bg-timber-100" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-timber-500">
                {formatMoney(p.isSaleActive && p.salePrice != null ? p.salePrice : p.price)}
              </span>
            </label>
          </li>
        ))}
        {!filtered.length && <li className="px-3 py-6 text-center text-sm text-timber-400">No products found</li>}
      </ul>
      <p className="border-t border-timber-100 px-3 py-2 text-xs text-timber-500">
        {chosen.size} product{chosen.size === 1 ? '' : 's'} selected
      </p>
    </div>
  );
}

function OffersTab() {
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_OFFER);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/offers').then((r) => setOffers(asArray(r.data))).catch(() => {});
  useEffect(() => {
    load();
    api.get('/products', { params: { limit: 2000 } }).then((r) => setProducts(asArray(r.data))).catch(() => {});
  }, []);

  const productName = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p.name])),
    [products]
  );

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_OFFER);
    setOpen(true);
  };

  const openEdit = (offer) => {
    setEditing(offer);
    setForm({
      name: offer.name,
      type: offer.type,
      appliesTo: offer.appliesTo,
      productIds: offer.productIds || [],
      isActive: offer.isActive,
    });
    setOpen(true);
  };

  const refreshStorefront = () => loadActiveOffers({ force: true });

  const save = async (e) => {
    e.preventDefault();
    if (form.appliesTo === 'selected' && !form.productIds.length) {
      return toast.error('Pick at least one product');
    }
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim() || OFFER_TYPES[form.type].label };
      if (editing) await api.put(`/offers/${editing.id}`, payload);
      else await api.post('/offers', payload);
      toast.success(editing ? 'Offer updated' : 'Offer created');
      setOpen(false);
      load();
      refreshStorefront();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (offer) => {
    try {
      await api.put(`/offers/${offer.id}`, { isActive: !offer.isActive });
      load();
      refreshStorefront();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const remove = async (offer) => {
    if (!window.confirm(`Delete “${offer.name}”?`)) return;
    try {
      await api.delete(`/offers/${offer.id}`);
      load();
      refreshStorefront();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const scopeLabel = (offer) => {
    if (offer.appliesTo === 'all') return 'All items';
    const names = (offer.productIds || []).map((id) => productName[id]).filter(Boolean);
    if (!names.length) return `${offer.productIds?.length || 0} selected items`;
    return names.length <= 2
      ? names.join(', ')
      : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-zinc-500">
          Offers apply automatically in the bag — no code needed. In each group the cheapest item gets
          the discount. If an item qualifies for more than one offer, the better offer wins.
        </p>
        <button type="button" className="btn-wheat" onClick={openNew}>Add offer</button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Offer</th>
              <th>Applies to</th>
              <th>Orders</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.id}>
                <td>
                  <p className="font-semibold">{o.name}</p>
                  {o.name !== OFFER_TYPES[o.type]?.label && (
                    <p className="text-xs text-zinc-500">{OFFER_TYPES[o.type]?.label}</p>
                  )}
                </td>
                <td className="max-w-xs truncate text-sm">{scopeLabel(o)}</td>
                <td className="tabular-nums">{o.orderCount || 0}</td>
                <td>
                  <button type="button" className={o.isActive ? 'badge-green' : 'badge-gray'} onClick={() => toggle(o)}>
                    {o.isActive ? 'Active' : 'Off'}
                  </button>
                </td>
                <td>
                  <div className="flex justify-end gap-1">
                    <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(o)} aria-label="Edit offer">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => remove(o)} aria-label="Delete offer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!offers.length && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-zinc-400">
                  No offers yet — add a Buy 1 Get 1 or Buy 2 Get 1 offer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit offer' : 'New offer'} wide>
        <form onSubmit={save} className="space-y-5">
          <div>
            <p className="label">Offer type</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {OFFER_TYPE_KEYS.map((key) => {
                const selected = form.type === key;
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer flex-col gap-1 border px-3.5 py-3 transition ${
                      selected ? 'border-timber-900 bg-timber-50' : 'border-timber-200 hover:border-timber-400'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="offerType"
                        checked={selected}
                        onChange={() => setForm({ ...form, type: key })}
                      />
                      <span className="text-sm font-semibold">{OFFER_TYPES[key].label}</span>
                    </span>
                    <span className="ps-6 text-xs text-timber-500">{OFFER_EXAMPLES[key]}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="offer-name">Name shown to customers</label>
            <input
              id="offer-name"
              className="input"
              placeholder={OFFER_TYPES[form.type].label}
              value={form.name}
              maxLength={80}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div>
            <p className="label">Applies to</p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'All items on the website' },
                { id: 'selected', label: 'Selected items only' },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-center gap-2 border px-3.5 py-2.5 text-sm transition ${
                    form.appliesTo === opt.id ? 'border-timber-900 bg-timber-50' : 'border-timber-200 hover:border-timber-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="appliesTo"
                    checked={form.appliesTo === opt.id}
                    onChange={() => setForm({ ...form, appliesTo: opt.id })}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {form.appliesTo === 'selected' && (
            <ProductPicker
              products={products}
              selected={form.productIds}
              onChange={(productIds) => setForm({ ...form, productIds })}
            />
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>

          <button type="submit" className="btn-wheat w-full" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save offer' : 'Create offer'}
          </button>
        </form>
      </Modal>
    </>
  );
}

function CodesTab() {
  const [coupons, setCoupons] = useState([]);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_CODE);
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/coupons').then((r) => setCoupons(asArray(r.data))).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_CODE);
    setOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      code: c.code,
      discountPercentage: c.discountPercentage,
      maxUses: c.maxUses ?? '',
      isActive: c.isActive,
    });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, maxUses: form.maxUses === '' ? null : Number(form.maxUses) };
      if (editing) await api.put(`/coupons/${editing.id}`, payload);
      else await api.post('/coupons', payload);
      toast.success(editing ? 'Promo code updated' : 'Promo code created');
      setOpen(false);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c) => {
    try {
    await api.put(`/coupons/${c.id}`, { isActive: !c.isActive });
    load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete promo code ${c.code}?`)) return;
    try {
      await api.delete(`/coupons/${c.id}`);
    load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-zinc-500">
          Customers type these at checkout. Set a max number of orders and the code switches off by itself
          once it’s used up (canceled orders don’t count).
        </p>
        <button type="button" className="btn-wheat" onClick={openNew}>Add promo code</button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Used</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => {
              const usedUp = c.maxUses != null && c.usedCount >= c.maxUses;
              return (
              <tr key={c.id}>
                <td className="font-mono font-semibold">{c.code}</td>
                <td>{c.discountPercentage}%</td>
                  <td className="tabular-nums">
                    {c.usedCount || 0}
                    {c.maxUses != null ? ` / ${c.maxUses}` : ''}
                    {usedUp && (
                      <span className="ms-2 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                        Limit reached
                      </span>
                    )}
                  </td>
                <td>
                  <button type="button" className={c.isActive ? 'badge-green' : 'badge-gray'} onClick={() => toggle(c)}>
                    {c.isActive ? 'Active' : 'Off'}
                  </button>
                </td>
                <td>
                    <div className="flex justify-end gap-1">
                      <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(c)} aria-label="Edit promo code">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => remove(c)} aria-label="Delete promo code">
                        <Trash2 className="h-4 w-4" />
                  </button>
                    </div>
                </td>
                </tr>
              );
            })}
            {!coupons.length && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-zinc-400">No promo codes yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit promo code' : 'New promo code'}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label" htmlFor="code-code">Code</label>
            <input
              id="code-code"
              required
              className="input uppercase"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="code-pct">Discount %</label>
            <input
              id="code-pct"
              required
              type="number"
              min={1}
              max={90}
              className="input"
              value={form.discountPercentage}
              onChange={(e) => setForm({ ...form, discountPercentage: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="code-max">Max orders (optional)</label>
            <input
              id="code-max"
              type="number"
              min={1}
              className="input"
              placeholder="Unlimited"
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
            />
            <p className="mt-1 text-xs text-timber-500">
              The code turns off automatically after this many orders.
              {editing ? ` Used ${editing.usedCount || 0} time${editing.usedCount === 1 ? '' : 's'} so far.` : ''}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
          <button type="submit" className="btn-wheat w-full" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save promo code' : 'Create promo code'}
          </button>
        </form>
      </Modal>
    </>
  );
}

export default function StaffPromotions() {
  const [tab, setTab] = useState('offers');

  return (
    <>
      <div className="mb-5">
        <h1 className="page-title">Promotions</h1>
        <p className="page-subtitle">
          Automatic offers and promo codes — product sale prices are set on the Products page
        </p>
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

      {tab === 'offers' ? <OffersTab /> : <CodesTab />}
    </>
  );
}
