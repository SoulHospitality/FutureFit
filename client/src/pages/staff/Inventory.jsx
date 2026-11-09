import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Package, Search, TrendingUp } from 'lucide-react';
import api from '../../api/axios';
import { asArray, formatMoney } from '../../utils/helpers';

const FORECAST_WINDOWS = [7, 14, 30, 60, 90];

const skuKey = (r) => r.variantId || `${r.productId}-${r.color || ''}-${r.size || 'all'}`;

const shortDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** "Out now", "Today", "~6 days · 15 Nov", or "No recent sales". */
function daysLeftText(r) {
  if (r.out) return 'Out now';
  if (r.daysLeft == null) return 'No recent sales';
  if (r.daysLeft < 1) return 'Today';
  const days = Math.round(r.daysLeft);
  return `~${days} day${days === 1 ? '' : 's'} · ${shortDate(r.stockoutDate)}`;
}

function daysLeftClass(r, soonDays) {
  if (r.out) return 'text-red-600';
  if (r.daysLeft == null) return 'text-zinc-400';
  if (r.daysLeft <= 7) return 'text-red-600';
  if (r.daysLeft <= soonDays) return 'text-amber-700';
  return 'text-zinc-600';
}

function SkuName({ r }) {
  const variant = [r.color, r.size].filter(Boolean).join(' / ');
  return (
    <div className="min-w-0">
      <a
        href={`/product/${r.productId}`}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-zinc-900 hover:underline"
      >
        {r.name}
      </a>
      <p className="text-xs text-zinc-500">
        <span className="font-mono">{r.itemCode || '—'}</span>
        {variant ? ` · ${variant}` : ''}
      </p>
    </div>
  );
}

/** Report: running out soon, best sellers and out of stock, with an expected sell-out date. */
function StockForecast({ forecast, loading, days, onDays }) {
  const [view, setView] = useState('soon');
  const f = forecast || {};
  const soonDays = f.soonDays || 14;
  const windows = asArray(f.windows).length ? f.windows : FORECAST_WINDOWS;
  const lists = {
    soon: asArray(f.runningOut),
    best: asArray(f.bestSellers),
    out: asArray(f.outOfStock),
  };
  const list = lists[view];
  const tabs = [
    ['soon', `Running out soon (${lists.soon.length})`],
    ['best', 'Best sellers'],
    ['out', `Out of stock (${lists.out.length})`],
  ];
  const empty = {
    soon: `Nothing is expected to sell out in the next ${soonDays} days.`,
    best: 'No sales in this period.',
    out: 'Nothing is out of stock.',
  };

  return (
    <div className="sp-card mb-4 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
        <div className="flex items-start gap-2.5">
          <TrendingUp className="mt-0.5 h-4 w-4 text-zinc-500" strokeWidth={1.75} />
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Stock forecast</h2>
            <p className="text-xs text-zinc-400">
              When each item is expected to run out, at the pace it sold over the last {days} days
            </p>
          </div>
        </div>
        <label className="text-xs text-zinc-500">
          Based on
          <select
            className="ml-2 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-800"
            value={days}
            onChange={(e) => onDays(Number(e.target.value))}
          >
            {windows.map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-100 px-3 py-2.5">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              view === id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="max-h-[420px] overflow-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Stock</th>
              <th>Sold ({days}d)</th>
              <th>Per week</th>
              <th>Expected to run out</th>
              <th title="Units to order so stock covers the next 30 days at this pace">Reorder for 30 days</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-zinc-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading &&
              list.map((r, i) => (
                <tr key={skuKey(r)}>
                  <td>
                    <div className="flex items-center gap-2">
                      {view === 'best' && (
                        <span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-zinc-400">
                          {i + 1}
                        </span>
                      )}
                      <SkuName r={r} />
                    </div>
                  </td>
                  <td className="tabular-nums font-semibold">{r.stock}</td>
                  <td className="tabular-nums">{r.sold}</td>
                  <td className="tabular-nums text-zinc-600">{r.perWeek || 0}</td>
                  <td className={`whitespace-nowrap text-sm font-medium ${daysLeftClass(r, soonDays)}`}>
                    {daysLeftText(r)}
                  </td>
                  <td className="tabular-nums">{r.reorderQty > 0 ? r.reorderQty : '—'}</td>
                </tr>
              ))}
            {!loading && list.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-zinc-400">
                  {empty[view]}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-zinc-100 px-5 py-2.5 text-[11px] text-zinc-400">
        Forecasts assume each item keeps selling at the same pace. Canceled orders aren&apos;t counted,
        and items added recently are measured from the day they were added.
      </p>
    </div>
  );
}

export default function StaffInventory() {
  const [data, setData] = useState({ rows: [], summary: null, forecast: null });
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState('low');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .get('/analytics/inventory', { params: { days } })
      .then((r) => alive && setData(r.data || { rows: [], summary: null, forecast: null }))
      .catch(() => alive && setData({ rows: [], summary: null, forecast: null }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [days]);

  const changeDays = (d) => {
    setLoading(true);
    setDays(d);
  };

  const rows = asArray(data.rows);
  const filtered = useMemo(() => {
    let list = rows;
    if (tab === 'low') list = list.filter((r) => r.low || r.out);
    if (tab === 'out') list = list.filter((r) => r.out);
    if (tab === 'ok') list = list.filter((r) => !r.low && !r.out);
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((r) =>
        [r.itemCode, r.parentItemCode, r.name, r.color, r.size, r.category, r.audience]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      );
    }
    return list;
  }, [rows, tab, q]);

  const exportCsv = () => {
    const header = ['Item ID', 'Parent', 'Product', 'Color', 'Size', 'Stock', 'Category', 'Price', 'Status', `Sold (${days}d)`, 'Per week', 'Days left', 'Expected out', 'Reorder for 30 days'];
    const lines = filtered.map((r) =>
      [
        r.itemCode || '',
        r.parentItemCode || '',
        r.name,
        r.color || '',
        r.size || '',
        r.stock,
        r.category || '',
        r.price,
        r.out ? 'out' : r.low ? 'low' : 'ok',
        r.sold ?? 0,
        r.perWeek ?? 0,
        r.daysLeft ?? '',
        r.stockoutDate ? r.stockoutDate.slice(0, 10) : '',
        r.reorderQty ?? 0,
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
            <p className="page-subtitle">Every child SKU · Item ID + stock · low first</p>
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

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ['SKUs', s?.skus],
          ['In stock', s?.inStock],
          ['Low stock', s?.lowStock],
          ['Out of stock', s?.outOfStock],
          ['Running out soon', s?.runningOutSoon],
        ].map(([label, value]) => (
          <div key={label} className="sp-metric">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{value ?? '—'}</p>
          </div>
        ))}
      </div>

      <StockForecast forecast={data.forecast} loading={loading} days={days} onDays={changeDays} />

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
              placeholder="Search item ID, colour, size…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Item ID</th>
                <th>Product</th>
                <th>Color</th>
                <th>Size</th>
                <th>Stock</th>
                <th>Expected out</th>
                <th>Category</th>
                <th>Price</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-sm text-zinc-400">
                    Loading…
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={skuKey(r)}>
                  <td>
                    <span className="font-mono text-[12px] font-medium tracking-wide text-zinc-900">
                      {r.itemCode || '—'}
                    </span>
                    {r.parentItemCode ? (
                      <span className="mt-0.5 block font-mono text-[10px] text-zinc-400">
                        {r.parentItemCode}
                      </span>
                    ) : null}
                  </td>
                  <td className="font-medium text-zinc-900">{r.name}</td>
                  <td className="text-zinc-500">{r.color || '—'}</td>
                  <td className="text-zinc-500">{r.size || '—'}</td>
                  <td className="tabular-nums font-semibold">{r.stock}</td>
                  <td className={`whitespace-nowrap text-xs ${daysLeftClass(r, data.forecast?.soonDays || 14)}`}>
                    {daysLeftText(r)}
                  </td>
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
                  <td colSpan={10} className="py-12 text-center text-sm text-zinc-400">
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
