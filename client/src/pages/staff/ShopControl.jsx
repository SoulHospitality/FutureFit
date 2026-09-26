import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Save } from 'lucide-react';
import api from '../../api/axios';
import DragSortList from '../../components/staff/DragSortList';
import { asArray, formatMoney, getImageUrl } from '../../utils/helpers';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'men', label: 'Men' },
  { key: 'women', label: 'Women' },
  { key: 'kids', label: 'Kids' },
];

export default function StaffShopControl() {
  const [tab, setTab] = useState('all');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = (collection = tab) => {
    setLoading(true);
    setDirty(false);
    api
      .get(`/products/shop-order?collection=${collection}`)
      .then((r) => setProducts(asArray(r.data?.products)))
      .catch(() => {
        setProducts([]);
        toast.error('Could not load shop order');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const onReorder = (next) => {
    setProducts(next);
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/products/shop-order', {
        collection: tab,
        productIds: products.map((p) => p.id),
      });
      setDirty(false);
      toast.success(`${TABS.find((t) => t.key === tab)?.label || 'Shop'} order saved`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Shop Control</h1>
          <p className="page-subtitle">
            Drag products to set the order for All, Men, Women, and Kids on the storefront.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          disabled={!dirty || saving || loading}
          onClick={save}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save order'}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-zinc-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              if (dirty && !window.confirm('Discard unsaved order changes?')) return;
              setTab(t.key);
            }}
            className={`px-4 py-2.5 text-sm font-medium transition ${
              tab === t.key
                ? 'border-b-2 border-zinc-900 text-zinc-900'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="sp-card overflow-hidden">
        {loading ? (
          <div className="px-4 py-16 text-center text-sm text-zinc-400">Loading products…</div>
        ) : products.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-zinc-400">
            No products in this collection yet.
          </div>
        ) : (
          <>
            <div className="border-b border-zinc-100 px-4 py-2.5 text-xs text-zinc-500">
              {products.length} product{products.length === 1 ? '' : 's'} · drag the handle to
              reorder · save when done
              {dirty ? <span className="ml-2 font-medium text-amber-700">Unsaved changes</span> : null}
            </div>
            <DragSortList
              items={products}
              onReorder={onReorder}
              className="px-4"
              renderItem={(p) => (
                <div className="flex items-center gap-3">
                  <div className="h-14 w-12 shrink-0 overflow-hidden rounded bg-zinc-100">
                    {p.photos?.[0] ? (
                      <img
                        src={getImageUrl(p.photos[0], { width: 96 })}
                        alt=""
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{p.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {formatMoney(
                        p.isSaleActive && p.salePrice != null ? p.salePrice : p.price
                      )}
                      {tab === 'all' ? ` · ${p.audience}` : ''}
                      {p.status === 'draft' ? ' · Draft' : ''}
                      {p.type === 'bundle' ? ' · Bundle' : ''}
                    </p>
                  </div>
                </div>
              )}
            />
          </>
        )}
      </div>
    </>
  );
}
