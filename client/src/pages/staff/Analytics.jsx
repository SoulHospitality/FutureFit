import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Download, Loader2 } from 'lucide-react';
import api from '../../api/axios';
import DualLineChart from '../../components/staff/DualLineChart';
import DateRangePicker from '../../components/staff/DateRangePicker';
import { formatMoney } from '../../utils/helpers';
import { localIsoDate, rangeLabel, rangeParams, resolveRange } from '../../utils/dateRange';

function Change({ value }) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <span className={`text-xs font-medium ${up ? 'text-emerald-600' : 'text-zinc-400'}`}>
      {up ? '+' : ''}
      {value}%
    </span>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-15" → "Sun 15 Nov", "2026-11" → "Nov 2026", "2026-11-15T14:00" → "15 Nov, 14:00". */
function periodText(label, mode) {
  const s = String(label || '');
  if (mode === 'month' || /^\d{4}-\d{2}$/.test(s)) {
    const [y, mo] = s.split('-');
    return `${MONTHS[Number(mo) - 1] || mo} ${y}`;
  }
  const [date, time] = s.split('T');
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  const day = d.toLocaleDateString('en-GB', {
    ...(time ? {} : { weekday: 'short' }),
    day: 'numeric',
    month: 'short',
  });
  return time ? `${day}, ${time.slice(0, 5)}` : day;
}

/** Ranked list with proportional bars. */
function BarList({ title, note, rows, loading, money = false }) {
  const max = Math.max(...rows.map((r) => Number(r.value) || 0), 1);
  return (
    <div className="sp-card p-5">
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      {note ? <p className="text-xs text-zinc-400">{note}</p> : null}
      <ul className="mt-3 max-h-[320px] space-y-3 overflow-y-auto pr-1">
        {loading && <li className="text-sm text-zinc-400">Loading…</li>}
        {!loading &&
          rows.slice(0, 12).map((r) => (
            <li key={r.key}>
              <div className="mb-1 flex justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-medium text-zinc-700">{r.label}</span>
                <span className="shrink-0 tabular-nums text-zinc-900">
                  {money ? formatMoney(r.value) : r.value}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${((Number(r.value) || 0) / max) * 100}%` }}
                />
              </div>
              {r.sub ? <p className="mt-0.5 text-[11px] text-zinc-400">{r.sub}</p> : null}
            </li>
          ))}
        {!loading && !rows.length && <li className="text-sm text-zinc-400">No data for this range</li>}
      </ul>
    </div>
  );
}

export default function StaffAnalytics() {
  const [preset, setPreset] = useState('today');
  const [custom, setCustom] = useState(() => ({
    from: localIsoDate(new Date(Date.now() - 6 * 86400000)),
    to: localIsoDate(new Date()),
  }));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [insightId, setInsightId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);

  const range = useMemo(() => resolveRange(preset, custom), [preset, custom]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get('/analytics/summary', { params: rangeParams(range) })
      .then((r) => {
        if (alive) setData(r.data);
      })
      .catch(() => {
        if (alive) setData(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [range.from, range.to]);

  const m = data?.metrics;
  const breakdown = data?.breakdown;
  const insights = data?.insights || [];
  const activeInsight = insights.find((i) => i.id === insightId) || insights[0];
  const products = data?.byProduct || [];
  const itemSales = products.reduce((sum, p) => sum + (Number(p.revenue) || 0), 0);
  const mode = data?.range?.mode;
  const buckets = data?.salesOverTime?.current || [];
  // Newest first; for hourly views only hours that had orders
  const periodRows = [...(mode === 'hour' ? buckets.filter((b) => b.count) : buckets)].reverse();

  const exportReport = async () => {
    setExporting(true);
    try {
      const { data: full } = await api.get('/analytics/summary', {
        params: { ...rangeParams(range), include: 'orders' },
        timeout: 120000,
      });
      const { downloadSalesWorkbook } = await import('../../utils/salesExport');
      const label = rangeLabel(range);
      const stem = range.all ? 'all-time' : range.from === range.to ? range.from : `${range.from}_to_${range.to}`;
      await downloadSalesWorkbook(full, { periodLabel: label, fileStem: `futurefit-sales-${stem}` });
      toast.success('Sales report downloaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not export the sales report');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (insights[0]?.id) setInsightId(insights[0].id);
  }, [data?.range?.from, data?.range?.to, insights[0]?.id]);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Sales, orders, and product performance · EGP</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <DateRangePicker
            preset={preset}
            onPreset={setPreset}
            custom={custom}
            onCustom={setCustom}
            range={range}
          />
          <button
            type="button"
            onClick={exportReport}
            disabled={exporting || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </button>
          <Link
            to="/staff/reports"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Reports
          </Link>
        </div>
      </div>


      {insights.length > 0 && (
        <div className="sp-card mb-4 grid gap-0 overflow-hidden lg:grid-cols-[240px_1fr]">
          <div className="border-b border-zinc-100 bg-zinc-50/80 p-3 lg:border-b-0 lg:border-r">
            <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Insights
            </p>
            <ul className="space-y-0.5">
              {insights.map((ins) => (
                <li key={ins.id}>
                  <button
                    type="button"
                    onClick={() => setInsightId(ins.id)}
                    className={`w-full rounded-lg px-2.5 py-2 text-left text-sm ${
                      activeInsight?.id === ins.id
                        ? 'bg-white font-medium text-zinc-900 shadow-sm'
                        : 'text-zinc-600 hover:bg-white/70'
                    }`}
                  >
                    {ins.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-5">
            {activeInsight && (
              <>
                <p
                  className={`text-xs font-medium ${
                    activeInsight.tone === 'positive'
                      ? 'text-emerald-600'
                      : activeInsight.tone === 'warn'
                        ? 'text-amber-700'
                        : 'text-sky-700'
                  }`}
                >
                  Insight
                </p>
                <h2 className="mt-1 text-lg font-semibold text-zinc-900">{activeInsight.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{activeInsight.body}</p>
                {activeInsight.href && (
                  <Link
                    to={activeInsight.href}
                    className="mt-4 inline-block text-xs font-medium text-zinc-700 hover:underline"
                  >
                    Explore →
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total sales', value: formatMoney(m?.totalSales), change: m?.changes?.totalSales },
          { label: 'Orders', value: m?.orderCount ?? '—', change: m?.changes?.orderCount },
          {
            label: 'Avg. order value',
            value: formatMoney(m?.averageOrderValue),
            change: m?.changes?.averageOrderValue,
          },
          { label: 'Units sold', value: m?.unitsSold ?? '—', change: m?.changes?.unitsSold },
          { label: 'Net sales', value: formatMoney(m?.netSales), change: m?.changes?.netSales, hint: 'Items after discounts' },
          {
            label: 'Collected',
            value: formatMoney(m?.paid),
            hint: `Outstanding ${formatMoney(m?.outstanding ?? 0)}`,
          },
          {
            label: 'Conversion rate',
            value: m?.conversionRate != null ? `${Number(m.conversionRate).toFixed(2)}%` : '—',
            change: m?.changes?.conversionRate,
            hint: m?.sessions != null ? `${m.sessions} sessions` : '',
          },
          {
            label: 'Returning customer rate',
            value:
              m?.returningCustomerRate != null ? `${Number(m.returningCustomerRate).toFixed(0)}%` : '—',
            hint:
              m?.newCustomers != null
                ? `${m.newCustomers} new · ${m.returningCustomers} returning`
                : '',
          },
        ].map((card) => (
          <div key={card.label} className="sp-metric">
            <p className="text-xs font-medium text-zinc-500">{card.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
              {loading ? '…' : card.value}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2">
              <Change value={card.change} />
              {card.hint && !loading ? <span className="text-[11px] text-zinc-400">{card.hint}</span> : null}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <div className="sp-card p-5 xl:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Total sales over time</h2>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-600" /> Current
              </span>
              {!range.all && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-300" /> Previous period
                </span>
              )}
            </div>
          </div>
          {loading ? (
            <div className="h-[220px] animate-pulse rounded-lg bg-zinc-100" />
          ) : (
            <DualLineChart
              current={data?.salesOverTime?.current || []}
              previous={data?.salesOverTime?.previous || []}
            />
          )}
        </div>

        <div className="sp-card p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Total sales breakdown</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              ['Gross sales', breakdown?.grossSales],
              ['Discounts', breakdown?.discounts],
              ['Net sales', breakdown?.netSales],
              ['Shipping charges', breakdown?.shippingCharges],
              ['Total sales', breakdown?.totalSales],
            ].map(([label, value], i, arr) => (
              <li
                key={label}
                className={`flex items-center justify-between gap-3 ${
                  i === arr.length - 1 ? 'border-t border-zinc-100 pt-2.5 font-semibold' : ''
                }`}
              >
                <span className="text-zinc-600">{label}</span>
                <span className="tabular-nums text-zinc-900">{loading ? '—' : formatMoney(value)}</span>
              </li>
            ))}
          </ul>
          {!loading && m?.canceledCount > 0 && (
            <p className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
              {m.canceledCount} canceled order{m.canceledCount === 1 ? '' : 's'} (
              {formatMoney(m.canceledValue)}) not counted.
            </p>
          )}
        </div>
      </div>

      <div className="sp-card mb-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Sales by product</h2>
            <p className="text-xs text-zinc-400">
              {products.length} product{products.length === 1 ? '' : 's'} sold · what customers paid, after offers and coupons (shipping not included)
            </p>
          </div>
          {products.length > 10 && (
            <button
              type="button"
              onClick={() => setShowAllProducts((v) => !v)}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
            >
              {showAllProducts ? 'Show top 10' : `Show all ${products.length}`}
            </button>
          )}
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>Product</th>
                <th className="text-right">Units</th>
                <th className="text-right">Orders</th>
                <th className="text-right">Sales</th>
                <th className="w-[22%]">Share</th>
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
                (showAllProducts ? products : products.slice(0, 10)).map((p, i) => {
                  const share = itemSales > 0 ? (Number(p.revenue) / itemSales) * 100 : 0;
                  return (
                    <tr key={p.productId || p.name}>
                      <td className="tabular-nums text-zinc-400">{i + 1}</td>
                      <td className="font-medium text-zinc-900">
                        {p.productId ? (
                          <a
                            href={`/product/${p.productId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            {p.name}
                          </a>
                        ) : (
                          p.name
                        )}
                      </td>
                      <td className="text-right tabular-nums">{p.qty}</td>
                      <td className="text-right tabular-nums text-zinc-500">{p.orders}</td>
                      <td className="text-right tabular-nums font-medium">{formatMoney(p.revenue)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                            <div className="h-full rounded-full bg-blue-500" style={{ width: `${share}%` }} />
                          </div>
                          <span className="w-10 text-right text-xs tabular-nums text-zinc-500">
                            {share.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {!loading && !products.length && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-zinc-400">
                    No sales in this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <BarList
          title="Sales by category"
          rows={(data?.byCategory || []).map((c) => ({
            key: c.category,
            label: c.category,
            value: c.revenue,
            sub: `${c.qty} unit${c.qty === 1 ? '' : 's'}`,
          }))}
          loading={loading}
          money
        />
        <BarList
          title="Sales by payment method"
          rows={(data?.byPaymentMethod || []).map((p) => ({
            key: p.method,
            label: p.method,
            value: p.revenue,
            sub: `${p.orders} order${p.orders === 1 ? '' : 's'} · ${formatMoney(p.paid)} collected`,
          }))}
          loading={loading}
          money
        />
        <BarList
          title="Orders by location"
          note="By shipping governorate and area"
          rows={(data?.byLocation || []).map((l) => ({
            key: l.label,
            label: [l.state, l.city].filter(Boolean).join(' · ') || l.label,
            value: l.orders,
            sub: formatMoney(l.revenue),
          }))}
          loading={loading}
        />
      </div>

      <div className="sp-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            Sales by {mode === 'hour' ? 'hour' : mode === 'month' ? 'month' : 'day'}
          </h2>
          {mode === 'hour' && <p className="text-xs text-zinc-400">Hours with orders only</p>}
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{mode === 'hour' ? 'Hour' : mode === 'month' ? 'Month' : 'Date'}</th>
                <th className="text-right">Orders</th>
                <th className="text-right">Units</th>
                <th className="text-right">Gross sales</th>
                <th className="text-right">Discounts</th>
                <th className="text-right">Shipping</th>
                <th className="text-right">Total sales</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                periodRows.map((b) => (
                  <tr key={b.label} className={b.count ? '' : 'text-zinc-400'}>
                    <td className="whitespace-nowrap">{periodText(b.label, mode)}</td>
                    <td className="text-right tabular-nums">{b.count || 0}</td>
                    <td className="text-right tabular-nums">{b.units || 0}</td>
                    <td className="text-right tabular-nums">{formatMoney(b.gross || 0)}</td>
                    <td className="text-right tabular-nums">
                      {b.discounts ? `−${formatMoney(b.discounts)}` : formatMoney(0)}
                    </td>
                    <td className="text-right tabular-nums">{formatMoney(b.shipping || 0)}</td>
                    <td className="text-right tabular-nums font-medium">{formatMoney(b.value || 0)}</td>
                  </tr>
                ))}
              {!loading && !periodRows.length && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-zinc-400">
                    No sales in this period
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
