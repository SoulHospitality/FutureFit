import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, CreditCard, Package, Truck } from 'lucide-react';
import api from '../../api/axios';
import Sparkline from '../../components/staff/Sparkline';
import { useAuth } from '../../context/AuthContext';
import {
  asArray,
  formatMoney,
  formatStaffDate,
  isBostaSynced,
  paymentStatusMeta,
  sparkSeriesFromOrders,
} from '../../utils/helpers';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function pctChange(series) {
  if (!series?.length || series.length < 2) return null;
  const half = Math.floor(series.length / 2);
  const a = series.slice(0, half).reduce((s, n) => s + n, 0) / Math.max(half, 1);
  const b = series.slice(half).reduce((s, n) => s + n, 0) / Math.max(series.length - half, 1);
  if (a === 0 && b === 0) return 0;
  if (a === 0) return 100;
  return Math.round(((b - a) / a) * 100);
}

function Metric({ label, value, series, hint }) {
  const change = pctChange(series);
  const up = change != null && change >= 0;
  return (
    <div className="sp-metric min-w-[140px] flex-1">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div>
          <p className="text-xl font-semibold tracking-tight text-zinc-900 tabular-nums">{value}</p>
          {change != null && (
            <p className={`mt-0.5 text-xs font-medium ${up ? 'text-emerald-600' : 'text-zinc-400'}`}>
              {up ? '+' : ''}
              {change}%
            </p>
          )}
          {hint ? <p className="mt-0.5 text-[11px] text-zinc-400">{hint}</p> : null}
        </div>
        <Sparkline values={series} className="mb-1 h-7 w-[72px]" />
      </div>
    </div>
  );
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const [finance, setFinance] = useState(null);
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState(null);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const tasks = [
      api.get('/orders').then((r) => {
        if (alive) setAllOrders(asArray(r.data));
      }),
      api.get('/paymob/config').then((r) => {
        if (alive) setIntegrations(r.data);
      }),
      api.get('/analytics/activity').then((r) => {
        if (alive) setActivity(asArray(r.data?.events));
      }),
    ];
    if (user.role === 'admin') {
      tasks.push(api.get('/orders/finance').then((r) => (alive ? setFinance(r.data) : null)));
    }
    Promise.allSettled(tasks).finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [user.role]);

  const stats = useMemo(() => {
    const active = allOrders.filter((o) =>
      ['confirmed', 'out_for_delivery', 'pending'].includes(o.status)
    );
    const needFulfill = active.filter(
      (o) => o.status !== 'canceled' && o.status !== 'delivered' && !isBostaSynced(o)
    ).length;
    const needCapture = allOrders.filter(
      (o) => !o.isPaid && o.status !== 'canceled' && o.status !== 'delivered'
    ).length;
    const orderSeries = sparkSeriesFromOrders(allOrders, 14, 'count');
    const salesSeries = sparkSeriesFromOrders(allOrders, 14, 'revenue');
    const aov =
      allOrders.filter((o) => o.status !== 'canceled').length > 0
        ? allOrders
            .filter((o) => o.status !== 'canceled')
            .reduce((s, o) => s + Number(o.totalPrice), 0) /
          allOrders.filter((o) => o.status !== 'canceled').length
        : 0;
    return { needFulfill, needCapture, orderSeries, salesSeries, aov };
  }, [allOrders]);

  const recent = allOrders.slice(0, 8);
  const firstName = (user.name || 'there').split(' ')[0];

  return (
    <>
      {/* Shopify-style metric strip */}
      {user.role === 'admin' && (
        <div className="mb-6 flex flex-wrap gap-3">
          {loading && !finance ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="sp-metric h-[88px] min-w-[140px] flex-1 animate-pulse bg-zinc-100" />
            ))
          ) : (
            <>
              <Metric
                label="Orders"
                value={finance?.orderCount ?? allOrders.length}
                series={stats.orderSeries}
              />
              <Metric
                label="Gross sales"
                value={formatMoney(finance?.revenue ?? 0)}
                series={stats.salesSeries}
              />
              <Metric
                label="Collected"
                value={formatMoney(finance?.paid ?? 0)}
                series={stats.salesSeries}
                hint={`Outstanding ${formatMoney(finance?.outstanding ?? 0)}`}
              />
              <Metric
                label="Avg. order"
                value={formatMoney(stats.aov)}
                series={stats.orderSeries}
                hint={`${finance?.lowStock?.length || 0} low stock SKUs`}
              />
            </>
          )}
        </div>
      )}

      {user.role === 'ops' && (
        <div className="mb-6 flex flex-wrap gap-3">
          <Metric label="Open orders" value={stats.needFulfill + stats.needCapture} series={stats.orderSeries} />
          <Metric label="Need Bosta sync" value={stats.needFulfill} series={stats.orderSeries} />
          <Metric label="Capture payments" value={stats.needCapture} series={stats.salesSeries} />
        </div>
      )}

      {/* Home hero: greeting + action chips */}
      <div className="sp-card mb-6 px-6 py-8 sm:px-8">
        <p className="text-sm text-zinc-500">{greeting()}!</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Let&apos;s continue growing your business, {firstName}.
        </h1>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/staff/orders?tab=unfulfilled"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
          >
            <Package className="h-4 w-4 text-zinc-500" strokeWidth={1.75} />
            Fulfill orders
            {stats.needFulfill > 0 && (
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                {stats.needFulfill}
              </span>
            )}
          </Link>
          <Link
            to="/staff/orders?tab=unpaid"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
          >
            <CreditCard className="h-4 w-4 text-zinc-500" strokeWidth={1.75} />
            Capture payments
            {stats.needCapture > 0 && (
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                {stats.needCapture > 50 ? '50+' : stats.needCapture}
              </span>
            )}
          </Link>
          <Link
            to="/staff/live"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
          >
            <Truck className="h-4 w-4 text-zinc-500" strokeWidth={1.75} />
            Live View
          </Link>
          <Link
            to="/staff/analytics"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
          >
            Analytics
          </Link>
          <Link
            to="/staff/abandoned"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
          >
            Abandoned
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="sp-card overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Recent orders</h2>
              <p className="text-xs text-zinc-400">Auto-synced to Bosta when confirmed</p>
            </div>
            <Link
              to="/staff/orders"
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900"
            >
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {loading && recent.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-zinc-400">
                      Loading orders…
                    </td>
                  </tr>
                )}
                {recent.map((o) => {
                  const pay = paymentStatusMeta(o);
                  return (
                    <tr key={o.id} className={o.status === 'canceled' ? 'opacity-50' : ''}>
                      <td className="font-medium text-zinc-900">
                        <Link to={`/staff/orders/${o.id}`} className="hover:underline">
                          #{o.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="text-zinc-500">{formatStaffDate(o.createdAt)}</td>
                      <td>{o.customerName || o.user?.name || o.guestName || 'Guest'}</td>
                      <td className="tabular-nums">{formatMoney(o.totalPrice)}</td>
                      <td>
                        <span className={pay.className}>{pay.label}</span>
                      </td>
                      <td>
                        {isBostaSynced(o) ? (
                          <span className="sp-tag">bosta_synced</span>
                        ) : o.status === 'canceled' ? (
                          <span className="sp-tag">voided</span>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loading && recent.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-zinc-400">
                      No orders yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          {asArray(finance?.lowStock).length > 0 && (
            <div className="sp-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" strokeWidth={1.75} />
                <h2 className="text-sm font-semibold text-zinc-900">Low stock</h2>
              </div>
              <ul className="space-y-2.5">
                {asArray(finance.lowStock)
                  .slice(0, 6)
                  .map((p) => (
                    <li
                      key={`${p.id}-${p.size || 'all'}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate text-zinc-600">
                        {p.name}
                        {p.size ? ` · ${p.size}` : ''}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums text-zinc-900">
                        {p.stock}
                      </span>
                    </li>
                  ))}
              </ul>
              <Link
                to="/staff/inventory"
                className="mt-4 inline-block text-xs font-medium text-zinc-600 hover:text-zinc-900"
              >
                Open inventory →
              </Link>
            </div>
          )}

          <div className="sp-card p-5">
            <h2 className="text-sm font-semibold text-zinc-900">Activity</h2>
            <ul className="mt-3 max-h-72 space-y-3 overflow-y-auto">
              {activity.slice(0, 10).map((ev) => (
                <li key={ev.id}>
                  <Link to={ev.href || '/staff/orders'} className="block group">
                    <p className="text-sm font-medium text-zinc-800 group-hover:underline">
                      {ev.title}
                    </p>
                    <p className="text-xs text-zinc-500">{ev.body}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      {ev.at ? formatStaffDate(ev.at) : ''}
                    </p>
                  </Link>
                </li>
              ))}
              {!activity.length && (
                <li className="text-sm text-zinc-400">No recent activity</li>
              )}
            </ul>
          </div>

          <div className="sp-card p-5">
            <h2 className="text-sm font-semibold text-zinc-900">Integrations</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center justify-between gap-3">
                <span className="text-zinc-600">Paymob</span>
                <span
                  className={
                    integrations?.paymobEnabled ? 'sp-pill sp-pill-paid' : 'sp-pill sp-pill-void'
                  }
                >
                  {integrations?.paymobEnabled ? 'Connected' : 'Not configured'}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-zinc-600">Bosta</span>
                <span
                  className={
                    integrations?.bostaEnabled ? 'sp-pill sp-pill-paid' : 'sp-pill sp-pill-void'
                  }
                >
                  {integrations?.bostaEnabled ? 'Connected' : 'Not configured'}
                </span>
              </li>
            </ul>
            <Link
              to="/staff/settings"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-900"
            >
              Settings & webhooks →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
