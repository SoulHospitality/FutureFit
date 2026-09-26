import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Plus, Search, Trash2, X } from 'lucide-react';
import api from '../../api/axios';
import DragSortList from '../../components/staff/DragSortList';
import { asArray, formatMoney, getImageUrl } from '../../utils/helpers';

const SECTIONS = [
  {
    key: 'bestSellers',
    title: 'Best sellers',
    hint: 'Shown in the Best sellers rail on the homepage. Drag to reorder.',
    max: 12,
  },
  {
    key: 'packs',
    title: 'Packs & bundles',
    hint: 'Shown in the Packs & bundles rail on the homepage. Drag to reorder.',
    max: 12,
  },
];

export default function StaffHomepage() {
  const [bestSellers, setBestSellers] = useState([]);
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerFor, setPickerFor] = useState(null);
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const lists = { bestSellers, packs };
  const setters = { bestSellers: setBestSellers, packs: setPacks };

  const load = () => {
    setLoading(true);
    api
      .get('/homepage/admin')
      .then((r) => {
        setBestSellers(asArray(r.data?.bestSellers));
        setPacks(asArray(r.data?.packs));
      })
      .catch(() => {
        setBestSellers([]);
        setPacks([]);
        toast.error('Could not load homepage picks');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!pickerFor) return undefined;
    setCatalogLoading(true);
    api
      .get('/products?limit=500')
      .then((r) => setCatalog(asArray(r.data)))
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoading(false));
    return undefined;
  }, [pickerFor]);

  const selectedIds = useMemo(() => {
    if (!pickerFor) return new Set();
    return new Set((lists[pickerFor] || []).map((p) => p.id));
  }, [pickerFor, bestSellers, packs]);

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = catalog;
    if (!q) return rows.slice(0, 40);
    return rows
      .filter((p) =>
        [p.name, p.type, p.audience].filter(Boolean).join(' ').toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [catalog, query]);

  const removeAt = (key, index) => {
    setters[key]((prev) => prev.filter((_, i) => i !== index));
  };

  const addProduct = (product) => {
    if (!pickerFor) return;
    const meta = SECTIONS.find((s) => s.key === pickerFor);
    setters[pickerFor]((prev) => {
      if (prev.some((p) => p.id === product.id)) return prev;
      if (prev.length >= (meta?.max || 12)) {
        toast.error(`Max ${meta.max} items in ${meta.title}`);
        return prev;
      }
      return [...prev, product];
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/homepage', {
        bestSellers: bestSellers.map((p) => p.id),
        packs: packs.map((p) => p.id),
      });
      setBestSellers(asArray(data?.bestSellers));
      setPacks(asArray(data?.packs));
      toast.success('Homepage updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Homepage</h1>
          <p className="page-subtitle">
            Choose which products appear in Best sellers and Packs &amp; bundles on the storefront.
            Drag to set order.
          </p>
        </div>
        <button type="button" className="btn-wheat" disabled={saving || loading} onClick={save}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-timber-400">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {SECTIONS.map((section) => {
            const items = lists[section.key] || [];
            return (
              <section
                key={section.key}
                className="overflow-hidden rounded-xl border border-timber-100 bg-white"
              >
                <div className="flex items-start justify-between gap-3 border-b border-timber-50 bg-timber-50/60 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-timber-900">{section.title}</h2>
                    <p className="mt-0.5 text-xs text-timber-500">{section.hint}</p>
                    <p className="mt-1 text-[11px] text-timber-400">
                      {items.length} / {section.max} selected
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      setQuery('');
                      setPickerFor(section.key);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
                {items.length ? (
                  <DragSortList
                    items={items}
                    onReorder={(next) => setters[section.key](next)}
                    className="px-4"
                    renderItem={(p, i) => (
                      <div className="flex items-center gap-3">
                        <img
                          src={getImageUrl(p.photos?.[0], { width: 80 })}
                          alt=""
                          className="h-14 w-12 shrink-0 object-cover bg-timber-100"
                          draggable={false}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-timber-900">{p.name}</p>
                          <p className="mt-0.5 text-xs text-timber-500">
                            {formatMoney(
                              p.isSaleActive && p.salePrice != null ? p.salePrice : p.price
                            )}
                            {p.status === 'draft' ? ' · Draft' : ''}
                            {p.type === 'bundle' ? ' · Bundle' : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn-ghost btn-sm text-red-600"
                          onClick={() => removeAt(section.key, i)}
                          aria-label="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  />
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-timber-400">
                    No products yet — click Add to choose items.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}

      {pickerFor && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-timber-900/40"
            aria-label="Close"
            onClick={() => setPickerFor(null)}
          />
          <div className="relative z-[1] flex max-h-[85vh] w-full max-w-lg flex-col border border-timber-200 bg-white shadow-xl sm:max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-timber-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-timber-900">
                Add to {SECTIONS.find((s) => s.key === pickerFor)?.title}
              </h3>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center text-timber-500 hover:bg-timber-50"
                onClick={() => setPickerFor(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border-b border-timber-100 px-4 py-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-timber-400" />
                <input
                  className="input ps-9"
                  placeholder="Search products…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
              </label>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {catalogLoading ? (
                <p className="px-3 py-8 text-center text-sm text-timber-400">Loading catalog…</p>
              ) : filteredCatalog.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-timber-400">No matching products</p>
              ) : (
                <ul>
                  {filteredCatalog.map((p) => {
                    const added = selectedIds.has(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          disabled={added}
                          onClick={() => addProduct(p)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-start transition hover:bg-timber-50 disabled:opacity-40"
                        >
                          <img
                            src={getImageUrl(p.photos?.[0], { width: 64 })}
                            alt=""
                            className="h-12 w-10 object-cover bg-timber-100"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-timber-900">{p.name}</p>
                            <p className="text-xs text-timber-500">
                              {formatMoney(
                                p.isSaleActive && p.salePrice != null ? p.salePrice : p.price
                              )}
                            </p>
                          </div>
                          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-timber-500">
                            {added ? 'Added' : 'Add'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="border-t border-timber-100 px-4 py-3">
              <button type="button" className="btn-outline w-full" onClick={() => setPickerFor(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
