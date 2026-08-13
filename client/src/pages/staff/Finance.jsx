import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Wallet, ShoppingBag, Package, CircleDollarSign, Download } from 'lucide-react';
import api from '../../api/axios';
import StatCard from '../../components/ui/StatCard';
import { formatMoney, orderStatusBadge, orderStatusLabel } from '../../utils/helpers';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders' },
];

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename, headers, rows) {
  const lines = [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StaffFinance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'overview';

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    api
      .get(`/orders/finance?${q}`)
      .then((r) => setData(r.data))
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load finance'))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const orders = data?.orders || [];

  const exportOrders = () => {
    downloadCsv(
      `futurefit-orders-${from || 'all'}-${to || 'all'}.csv`,
      ['id', 'date', 'customer', 'paymentMethod', 'status', 'total', 'isPaid'],
      orders.map((o) => [
        o.id,
        o.createdAt,
        o.customerName || o.user?.name || o.guestName || 'Guest',
        o.paymentMethod,
        o.status,
        o.totalPrice,
        o.isPaid ? 'yes' : 'no',
      ])
    );
  };

  const rangeLabel = useMemo(() => {
    if (!from && !to) return 'All time';
    return `${from || '…'} → ${to || '…'}`;
  }, [from, to]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-timber-400">
            Admin
          </p>
          <h1 className="mt-1 page-title">Finance</h1>
          <p className="page-subtitle">Revenue, collected cash, and order performance</p>
        </div>
        <button
          type="button"
          className="btn-outline btn-sm"
          onClick={exportOrders}
          disabled={!orders.length}
        >
          <Download className="mr-1 h-3.5 w-3.5" strokeWidth={1.5} />
          Orders CSV
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">From</label>
          <input
            type="date"
            className="input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button type="button" className="btn-dark" onClick={load}>
          Apply
        </button>
        <p className="pb-2 text-xs text-timber-400">{rangeLabel}</p>
      </div>

      <div className="mb-6 flex gap-1 border-b border-timber-100">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-timber-900 text-timber-900'
                : 'border-transparent text-timber-500 hover:text-timber-800'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <p className="text-sm text-timber-400">Loading…</p>
      ) : data ? (
        <>
          {tab === 'overview' && <OverviewTab data={data} />}
          {tab === 'orders' && <OrdersTab orders={orders} />}
        </>
      ) : null}
    </>
  );
}

function OverviewTab({ data }) {
  const statusEntries = Object.entries(data.byStatus || {});
  const paymentEntries = Object.entries(data.byPaymentMethod || {});

  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Gross revenue"
          value={formatMoney(data.revenue)}
          icon={Wallet}
          tone="wheat"
        />
        <StatCard
          title="Collected"
          value={formatMoney(data.paid)}
          icon={ShoppingBag}
          tone="green"
        />
        <StatCard
          title="Outstanding"
          value={formatMoney(data.outstanding ?? Math.max(0, data.revenue - data.paid))}
          icon={CircleDollarSign}
          tone="red"
        />
        <StatCard title="Orders" value={data.orderCount} icon={Package} tone="muted" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="text-sm font-semibold text-timber-900">By status</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {statusEntries.length === 0 && (
              <li className="text-timber-400">No orders in range</li>
            )}
            {statusEntries.map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-3">
                <span className={orderStatusBadge[k]}>{orderStatusLabel[k] || k}</span>
                <span className="font-medium tabular-nums">{v}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-timber-900">By payment method</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {paymentEntries.length === 0 && (
              <li className="text-timber-400">No payment data</li>
            )}
            {paymentEntries.map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-3">
                <span className="text-timber-700">{k}</span>
                <span className="font-medium tabular-nums">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

function OrdersTab({ orders }) {
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="border-b border-timber-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-timber-900">Orders in range</h2>
        <p className="text-xs text-timber-400">{orders.length} records</p>
      </div>
      <div className="table-wrapper !border-0 !rounded-none">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Total</th>
              <th>Paid</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="font-mono text-xs">{o.id.slice(0, 8)}</td>
                <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                <td>{o.customerName || o.user?.name || o.guestName || 'Guest'}</td>
                <td>{o.paymentMethod}</td>
                <td>
                  <span className={orderStatusBadge[o.status]}>
                    {orderStatusLabel[o.status]}
                  </span>
                </td>
                <td className="tabular-nums">{formatMoney(o.totalPrice)}</td>
                <td>
                  <span className={o.isPaid ? 'badge-green' : 'badge-yellow'}>
                    {o.isPaid ? 'Paid' : 'Unpaid'}
                  </span>
                </td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-timber-400">
                  No orders in this range
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
