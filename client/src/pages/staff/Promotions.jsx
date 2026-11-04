import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Gift, Pencil, Search, Ticket, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import { asArray, audienceLabel, getImageUrl, formatMoney } from '../../utils/helpers';
import { OFFER_TYPES, OFFER_TYPE_KEYS, loadActiveOffers, offerLabel } from '../../utils/offers';

const TABS = [
  { id: 'offers', label: 'Offers', icon: Gift },
  { id: 'codes', label: 'Promo codes', icon: Ticket },
];

/** Staff-facing names in the type picker (percent_off's customer label depends on the %). */
const TYPE_PICKER_LABEL = { percent_off: 'Percentage off' };

const OFFER_EXAMPLES = {
  buy1get1_free: 'Bag 500 + 300 → the 300 item is free',
  buy2get1_free: 'Bag 500 + 400 + 300 → the 300 item is free',
  buy1get1_half: 'Bag 500 + 300 → the 300 item is 150',
  buy2get1_half: 'Bag 500 + 400 + 300 → the 300 item is 150',
  percent_off: 'At 20% off, a 500 item is 400 — on every covered item',
};

const SCOPES = [
  { id: 'all', label: 'All items on the website' },
  { id: 'category', label: 'A category' },
  { id: 'subcategory', label: 'A subcategory' },
  { id: 'selected', label: 'Certain products' },
];

const SCOPE_KIND = { category: 'Category', subcategory: 'Subcategory', selected: 'Products' };

const EMPTY_OFFER = {
  name: '',
  type: 'buy1get1_free',
  percentage: 20,
  appliesTo: 'all',
  productIds: [],
  categoryIds: [],
  isActive: true,
};

const EMPTY_CODE = { code: '', discountPercentage: 10, maxUses: '', isActive: true };

const errMsg = (err) => err.response?.data?.message || 'Something went wrong';

const isCategoryScope = (scope) => scope === 'category' || scope === 'subcategory';

/** "Men" for a root category, "Men › Boxers" for a subcategory. */
const categoryPath = (c) => {
  if (!c) return '';
  if (c.parent?.name) return `${c.parent.name} › ${c.name}`;
  const dept = audienceLabel(c.audience);
  return dept && dept.toLowerCase() !== c.name.toLowerCase() ? `${c.name} (${dept})` : c.name;
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Searchable checkbox list shared by the product and category pickers. */
function Checklist({ items, selected, onChange, textOf, placeholder, renderRow, footer, emptyText }) {
  const [q, setQ] = useState('');
  const chosen = useMemo(() => new Set(selected), [selected]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => textOf(item).toLowerCase().includes(term));
  }, [items, q, textOf]);

  const toggle = (id) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const allFilteredOn = filtered.length > 0 && filtered.every((item) => chosen.has(item.id));
  const toggleFiltered = () => {
    const next = new Set(chosen);
    filtered.forEach((item) => (allFilteredOn ? next.delete(item.id) : next.add(item.id)));
    onChange([...next]);
  };

  return (
    <div className="border border-timber-200">
      <div className="flex items-center gap-2 border-b border-timber-100 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-timber-400" />
        <input
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm focus:ring-0"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="btn-ghost btn-sm shrink-0" onClick={toggleFiltered}>
          {allFilteredOn ? 'Clear' : 'Select all'}
        </button>
      </div>
      <ul className="max-h-72 overflow-y-auto">
        {filtered.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-timber-50">
              <input type="checkbox" checked={chosen.has(item.id)} onChange={() => toggle(item.id)} />
              {renderRow(item)}
            </label>
          </li>
        ))}
        {!filtered.length && <li className="px-3 py-6 text-center text-sm text-timber-400">{emptyText}</li>}
      </ul>
      <p className="border-t border-timber-100 px-3 py-2 text-xs text-timber-500">{footer(chosen.size)}</p>
    </div>
  );
}

const productText = (p) => p.name;

function ProductPicker({ products, selected, onChange }) {
  return (
    <Checklist
      items={products}
      selected={selected}
      onChange={onChange}
      textOf={productText}
      placeholder="Search products"
      emptyText="No products found"
      footer={(n) => `${plural(n, 'product', 'products')} selected`}
      renderRow={(p) => (
        <>
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
        </>
      )}
    />
  );
}

function CategoryPicker({ categories, selected, onChange, roots }) {
  const [one, many] = roots ? ['category', 'categories'] : ['subcategory', 'subcategories'];
  return (
    <Checklist
      items={categories}
      selected={selected}
      onChange={onChange}
      textOf={categoryPath}
      placeholder={`Search ${many}`}
      emptyText={`No ${many} found`}
      footer={(n) =>
        `${plural(n, one, many)} selected${roots ? ' — includes all of their subcategories' : ''}`
      }
      renderRow={(c) => (
        <>
          <span className="min-w-0 flex-1 truncate text-sm">{categoryPath(c)}</span>
          <span className="shrink-0 text-xs tabular-nums text-timber-500">
            {roots && c.childCount ? plural(c.childCount, 'subcategory', 'subcategories') : plural(c.productCount || 0, 'item', 'items')}
          </span>
        </>
      )}
    />
  );
}

function OffersTab() {
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_OFFER);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/offers').then((r) => setOffers(asArray(r.data))).catch(() => {});
  useEffect(() => {
    load();
    api.get('/products', { params: { scope: 'staff', limit: 2000 } }).then((r) => setProducts(asArray(r.data))).catch(() => {});
    api.get('/categories').then((r) => setCategories(asArray(r.data))).catch(() => {});
  }, []);

  const productName = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p.name])),
    [products]
  );
  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories]
  );
  const rootCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const subCategories = useMemo(
    () =>
      categories
        .filter((c) => c.parentId)
        .sort((a, b) => categoryPath(a).localeCompare(categoryPath(b))),
    [categories]
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
      percentage: offer.percentage ?? EMPTY_OFFER.percentage,
      appliesTo: offer.appliesTo,
      productIds: offer.productIds || [],
      categoryIds: offer.categoryIds || [],
      isActive: offer.isActive,
    });
    setOpen(true);
  };

  // Category and subcategory lists hold different ids, so switching between them starts fresh
  const setScope = (appliesTo) =>
    setForm((f) => ({
      ...f,
      appliesTo,
      categoryIds: appliesTo === f.appliesTo ? f.categoryIds : [],
    }));

  const refreshStorefront = () => loadActiveOffers({ force: true });

  const save = async (e) => {
    e.preventDefault();
    const isPercent = form.type === 'percent_off';
    const pct = Number(form.percentage);
    if (isPercent && (!Number.isFinite(pct) || pct < 1 || pct > 90)) {
      return toast.error('Enter a discount between 1% and 90%');
    }
    if (form.appliesTo === 'selected' && !form.productIds.length) {
      return toast.error('Pick at least one product');
    }
    if (form.appliesTo === 'category' && !form.categoryIds.length) {
      return toast.error('Pick at least one category');
    }
    if (form.appliesTo === 'subcategory' && !form.categoryIds.length) {
      return toast.error('Pick at least one subcategory');
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        percentage: isPercent ? pct : null,
        productIds: form.appliesTo === 'selected' ? form.productIds : [],
        categoryIds: isCategoryScope(form.appliesTo) ? form.categoryIds : [],
        name: form.name.trim() || offerLabel({ type: form.type, percentage: pct }),
      };
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
    if (!offer.appliesTo || offer.appliesTo === 'all') return 'All items';
    const category = isCategoryScope(offer.appliesTo);
    const ids = (category ? offer.categoryIds : offer.productIds) || [];
    const names = category
      ? ids.map((id) => categoryById[id]).filter(Boolean).map(categoryPath)
      : ids.map((id) => productName[id]).filter(Boolean);
    if (!names.length) {
      return `${ids.length} ${category ? (offer.appliesTo === 'category' ? 'categories' : 'subcategories') : 'selected items'}`;
    }
    return names.length <= 2
      ? names.join(', ')
      : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-zinc-500">
          Offers apply automatically in the bag — no code needed. A percentage offer takes the % off every
          item it covers; Buy X Get 1 offers discount the cheapest item in each group. If an item qualifies
          for more than one offer, the better offer wins.
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
                  {o.name !== offerLabel(o) && <p className="text-xs text-zinc-500">{offerLabel(o)}</p>}
                </td>
                <td className="max-w-xs text-sm">
                  {SCOPE_KIND[o.appliesTo] && (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                      {SCOPE_KIND[o.appliesTo]}
                    </p>
                  )}
                  <p className="truncate">{scopeLabel(o)}</p>
                </td>
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
                  No offers yet — add a percentage off, Buy 1 Get 1 or Buy 2 Get 1 offer.
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
                      <span className="text-sm font-semibold">
                        {TYPE_PICKER_LABEL[key] || OFFER_TYPES[key].label}
                      </span>
                    </span>
                    <span className="ps-6 text-xs text-timber-500">{OFFER_EXAMPLES[key]}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {form.type === 'percent_off' && (
            <div>
              <label className="label" htmlFor="offer-pct">Discount %</label>
              <div className="flex max-w-[12rem] items-center gap-2">
                <input
                  id="offer-pct"
                  required
                  type="number"
                  min={1}
                  max={90}
                  step={1}
                  className="input"
                  value={form.percentage}
                  onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                />
                <span className="text-sm text-timber-500">%</span>
              </div>
              <p className="mt-1 text-xs text-timber-500">
                Taken off the price the customer pays, on top of any product sale price.
              </p>
            </div>
          )}

          <div>
            <label className="label" htmlFor="offer-name">Name shown to customers</label>
            <input
              id="offer-name"
              className="input"
              placeholder={offerLabel({ type: form.type, percentage: form.percentage })}
              value={form.name}
              maxLength={80}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div>
            <p className="label">Applies to</p>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map((opt) => (
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
                    onChange={() => setScope(opt.id)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {form.appliesTo === 'category' && (
            <CategoryPicker
              roots
              categories={rootCategories}
              selected={form.categoryIds}
              onChange={(categoryIds) => setForm({ ...form, categoryIds })}
            />
          )}

          {form.appliesTo === 'subcategory' && (
            <CategoryPicker
              categories={subCategories}
              selected={form.categoryIds}
              onChange={(categoryIds) => setForm({ ...form, categoryIds })}
            />
          )}

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
