import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Package, Search } from 'lucide-react';
import api from '../../api/axios';
import { asArray, formatMoney } from '../../utils/helpers';

export default function StaffInventory() {
  const [data, setData] = useState({ rows: [], summary: null });
  const [tab, setTab] = useState('low');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/analytics/inventory')
      .then((r) => setData(r.data || { rows: [], summary: null }))
      .catch(() => setData({ rows: [], summary: null }))
      .finally(() => setLoading(false));
  }, []);

  const rows = asArray(data.rows);
  const filtered = useMemo(() => {
    let list = rows;
    if (tab === 'low') list = list.filter((r) => r.low || r.out);
    if (tab === 'out') list = list.filter((r) => r.out);
    if (tab === 'ok') list = list.filter((r) => !r.low && !r.out);
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((r) =>
        [r.name, r.size, r.category, r.audience].filter(Boolean).join(' ').toLowerCase().includes(query)
      );
    }
    return list;
  }, [rows, tab, q]);

  const exportCsv = () => {
    const header = ['Product', 'Size', 'Stock', 'Category', 'Price', 'Status'];
    const lines = filtered.map((r) =>
      [
        r.name,
        r.size || '',
        r.stock,
        r.category || '',
        r.price,
        r.out ? 'out' : r.low ? 'low' : 'ok',
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const s = data.summary;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 text-white">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h1 className="page-title">Inventory</h1>
            <p className="page-subtitle">Stock by size · low stock first</p>
          </div>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white"
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[
          ['SKUs', s?.skus],
          ['In stock', s?.inStock],
          ['Low stock', s?.lowStock],
          ['Out of stock', s?.outOfStock],
        ].map(([label, value]) => (
          <div key={label} className="sp-metric">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{value ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className="sp-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
          {[
            ['low', 'Needs attention'],
            ['out', 'Out of stock'],
            ['ok', 'Healthy'],
            ['all', 'All'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {label}
            </button>
          ))}
          <div className="relative ml-auto min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-sm"
              placeholder="Search SKUs"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Size</th>
                <th>Stock</th>
                <th>Category</th>
                <th>Price</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-zinc-400">
                    Loading…
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={`${r.productId}-${r.size || 'all'}`}>
                  <td className="font-medium text-zinc-900">{r.name}</td>
                  <td className="text-zinc-500">{r.size || '—'}</td>
                  <td className="tabular-nums font-semibold">{r.stock}</td>
                  <td className="text-zinc-500">{r.category || '—'}</td>
                  <td className="tabular-nums">{formatMoney(r.price)}</td>
                  <td>
                    <span
                      className={`sp-pill ${
                        r.out ? 'sp-pill-danger' : r.low ? 'sp-pill-warn' : 'sp-pill-paid'
                      }`}
                    >
                      {r.out ? 'Out of stock' : r.low ? 'Low stock' : 'In stock'}
                    </span>
                  </td>
                  <td>
                    <Link
                      to="/staff/products"
                      className="text-xs font-medium text-zinc-600 hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-zinc-400">
                    No SKUs match
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
