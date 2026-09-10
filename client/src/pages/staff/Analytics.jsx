import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import DualLineChart from '../../components/staff/DualLineChart';
import { formatMoney } from '../../utils/helpers';

const PRESETS = [
  { id: 'today', label: 'Today', days: 0 },
  { id: '7d', label: 'Last 7 days', days: 6 },
  { id: '30d', label: 'Last 30 days', days: 29 },
  { id: 'ytd', label: 'Year to date', days: null },
  { id: 'custom', label: 'Custom', days: null },
];

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function rangeForPreset(id) {
  const end = new Date();
  const start = new Date();
  if (id === 'today') {
    return { from: isoDate(end), to: isoDate(end) };
  }
  if (id === 'ytd') {
    start.setMonth(0, 1);
    return { from: isoDate(start), to: isoDate(end) };
  }
  const preset = PRESETS.find((p) => p.id === id) || PRESETS[1];
  start.setDate(end.getDate() - (preset.days || 6));
  return { from: isoDate(start), to: isoDate(end) };
}

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

export default function StaffAnalytics() {
  const [preset, setPreset] = useState('today');
  const [customFrom, setCustomFrom] = useState(() => isoDate(new Date(Date.now() - 6 * 86400000)));
  const [customTo, setCustomTo] = useState(() => isoDate(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [insightId, setInsightId] = useState(null);

  const range = useMemo(() => {
    if (preset === 'custom') return { from: customFrom, to: customTo };
    return rangeForPreset(preset);
  }, [preset, customFrom, customTo]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get('/analytics/summary', { params: range })
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
  const maxLoc = Math.max(...(data?.byLocation || []).map((l) => l.orders), 1);

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
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                preset === p.id
                  ? 'bg-zinc-900 text-white'
                  : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {p.label}
            </button>
          ))}
          <Link
            to="/staff/reports"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Reports
          </Link>
        </div>
      </div>

      {preset === 'custom' && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="text-xs text-zinc-500">
            From
            <input
              type="date"
              className="ml-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <label className="text-xs text-zinc-500">
            To
            <input
              type="date"
              className="ml-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </label>
        </div>
      )}

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

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Gross sales',
            value: formatMoney(m?.grossSales),
            change: m?.changes?.grossSales,
          },
          {
            label: 'Orders',
            value: m?.orderCount ?? '—',
            change: m?.changes?.orderCount,
          },
          {
            label: 'Conversion rate',
            value:
              m?.conversionRate != null ? `${Number(m.conversionRate).toFixed(2)}%` : '—',
            change: m?.changes?.conversionRate,
          },
          {
            label: 'Returning customer rate',
            value:
              m?.returningCustomerRate != null
                ? `${Number(m.returningCustomerRate).toFixed(0)}%`
                : '—',
            change: null,
          },
        ].map((card) => (
          <div key={card.label} className="sp-metric">
            <p className="text-xs font-medium text-zinc-500">{card.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
              {loading ? '…' : card.value}
            </p>
            <div className="mt-1">
              <Change value={card.change} />
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
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-300" /> Previous period
              </span>
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
              ['Sales reversals', breakdown?.salesReversals],
              ['Net sales', breakdown?.netSales],
              ['Shipping charges', breakdown?.shippingCharges],
              ['Return fees', breakdown?.returnFees],
              ['Taxes', breakdown?.taxes],
              ['Total sales', breakdown?.totalSales],
            ].map(([label, value], i, arr) => (
              <li
                key={label}
                className={`flex items-center justify-between gap-3 ${
                  i === arr.length - 1 ? 'border-t border-zinc-100 pt-2.5 font-semibold' : ''
                }`}
              >
                <span className="text-zinc-600">{label}</span>
                <span className="tabular-nums text-zinc-900">
                  {loading ? '—' : formatMoney(value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="sp-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Total sales by sales channel</h2>
          {(data?.byChannel || []).map((c) => (
            <div key={c.channel} className="flex items-center justify-between text-sm">
              <span className="text-zinc-600">{c.channel}</span>
              <span className="font-medium tabular-nums">{formatMoney(c.revenue)}</span>
            </div>
          ))}
          {!data?.byChannel?.length && (
            <p className="text-sm text-zinc-400">No data for this range</p>
          )}
        </div>

        <div className="sp-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Total sales by product</h2>
          <ul className="space-y-2">
            {(data?.byProduct || []).slice(0, 8).map((p) => (
              <li key={p.productId || p.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-zinc-600">{p.name}</span>
                <span className="shrink-0 tabular-nums text-zinc-900">{formatMoney(p.revenue)}</span>
              </li>
            ))}
            {!data?.byProduct?.length && (
              <li className="text-sm text-zinc-400">No data for this range</li>
            )}
          </ul>
        </div>

        <div className="sp-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Sessions by location</h2>
          <p className="mb-3 text-xs text-zinc-400">Orders by shipping city</p>
          <ul className="space-y-2.5">
            {(data?.byLocation || []).slice(0, 8).map((l) => (
              <li key={l.label}>
                <div className="mb-1 flex justify-between gap-2 text-xs">
                  <span className="truncate text-zinc-600">{l.label}</span>
                  <span className="tabular-nums text-zinc-800">{l.orders}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${(l.orders / maxLoc) * 100}%` }}
                  />
                </div>
              </li>
            ))}
            {!data?.byLocation?.length && (
              <li className="text-sm text-zinc-400">No data for this range</li>
            )}
          </ul>
        </div>
      </div>
    </>
  );
}
