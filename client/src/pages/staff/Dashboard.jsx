import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  ShoppingBag,
  AlertTriangle,
  Truck,
  Images,
  Tag,
  Wallet,
  Boxes,
} from 'lucide-react';
import api from '../../api/axios';
import StatCard from '../../components/ui/StatCard';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, orderStatusBadge, orderStatusLabel } from '../../utils/helpers';

const QUICK_LINKS_ADMIN = [
  { to: '/staff/products', label: 'Products', icon: Package },
  { to: '/staff/orders', label: 'Orders', icon: Boxes },
  { to: '/staff/deliveries', label: 'Deliveries', icon: Truck },
  { to: '/staff/slides', label: 'Slideshow', icon: Images },
  { to: '/staff/promotions', label: 'Promotions', icon: Tag },
  { to: '/staff/finance', label: 'Finance', icon: Wallet },
];

const QUICK_LINKS_OPS = [
  { to: '/staff/deliveries', label: 'Deliveries', icon: Truck },
  { to: '/staff/problems', label: 'Problems', icon: AlertTriangle },
];

export default function StaffDashboard() {
  const { user } = useAuth();
  const [finance, setFinance] = useState(null);
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const tasks = [
      api.get('/orders').then((r) => {
        if (!alive) return;
        const list = Array.isArray(r.data) ? r.data : [];
        setAllOrders(list);
        setOrders(list.slice(0, 8));
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

  const opsStats = useMemo(() => {
    const active = allOrders.filter((o) =>
      ['confirmed', 'out_for_delivery'].includes(o.status)
    ).length;
    const problems = allOrders.filter((o) => o.status === 'problem').length;
    const pending = allOrders.filter((o) => o.status === 'pending').length;
    return { active, problems, pending };
  }, [allOrders]);

  const statusEntries = Object.entries(finance?.byStatus || {}).sort((a, b) => b[1] - a[1]);
  const statusTotal = statusEntries.reduce((sum, [, n]) => sum + n, 0) || 1;
  const quickLinks = user.role === 'admin' ? QUICK_LINKS_ADMIN : QUICK_LINKS_OPS;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-timber-400">
            Overview
          </p>
          <h1 className="mt-1 page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user.name.split(' ')[0]}</p>
        </div>
        <Link to="/" className="btn-outline btn-sm text-[10px] uppercase tracking-[0.18em]">
          View storefront
        </Link>
      </div>

      {user.role === 'admin' && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading && !finance
            ? [1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 animate-pulse border border-timber-100 bg-white" />
              ))
            : finance && (
                <>
                  <StatCard
                    title="Revenue"
                    value={formatMoney(finance.revenue)}
                    icon={ShoppingBag}
                    tone="wheat"
                    hint={`${finance.orderCount} orders`}
                  />
                  <StatCard
                    title="Collected"
                    value={formatMoney(finance.paid)}
                    icon={Wallet}
                    tone="green"
                    hint={`Outstanding ${formatMoney(finance.outstanding ?? Math.max(0, Number(finance.revenue) - Number(finance.paid)))}`}
                  />
                  <StatCard
                    title="Net cash"
                    value={formatMoney(
                      finance.netCash ??
                        Number(finance.paid) - Number(finance.expensesTotal || 0)
                    )}
                    icon={Truck}
                    tone="muted"
                    hint={`Expenses ${formatMoney(finance.expensesTotal || 0)}`}
                  />
                  <StatCard
                    title="Low stock"
                    value={finance.lowStock?.length || 0}
                    icon={AlertTriangle}
                    tone="red"
                    hint={`${finance.byStatus?.out_for_delivery || 0} out for delivery`}
                  />
                </>
              )}
        </div>
      )}

      {user.role === 'ops' && (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {loading
            ? [1, 2, 3].map((i) => (
                <div key={i} className="h-28 animate-pulse border border-timber-100 bg-white" />
              ))
            : (
                <>
                  <StatCard title="Pending" value={opsStats.pending} icon={Package} tone="muted" />
                  <StatCard
                    title="Active deliveries"
                    value={opsStats.active}
                    icon={Truck}
                    tone="wheat"
                  />
                  <StatCard
                    title="Problems"
                    value={opsStats.problems}
                    icon={AlertTriangle}
                    tone="red"
                  />
                </>
              )}
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {quickLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="flex items-center gap-3 border border-timber-200 bg-white px-4 py-3 transition hover:border-timber-900 hover:bg-timber-50"
          >
            <link.icon className="h-4 w-4 text-timber-700" strokeWidth={1.5} />
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-timber-800">
              {link.label}
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card xl:col-span-2 !p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-timber-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-timber-900">Recent orders</h2>
              <p className="text-xs text-timber-400">Latest essentials across the store</p>
            </div>
            <Link
              to="/staff/deliveries"
              className="btn-outline btn-sm text-[10px] uppercase tracking-[0.16em]"
            >
              Deliveries
            </Link>
          </div>
          <div className="table-wrapper !border-0 !rounded-none">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-timber-400">
                      Loading orders…
                    </td>
                  </tr>
                )}
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="font-mono text-xs">{o.id.slice(0, 8)}</td>
                    <td>{o.customerName || o.user?.name || o.guestName || 'Guest'}</td>
                    <td className="tabular-nums">{formatMoney(o.totalPrice)}</td>
                    <td>
                      <span className={o.isPaid ? 'badge-green' : 'badge-yellow'}>
                        {o.isPaid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td>
                      <span className={orderStatusBadge[o.status]}>
                        {orderStatusLabel[o.status]}
                      </span>
                    </td>
                  </tr>
                ))}
                {!loading && orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-timber-400">
                      No orders yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          {user.role === 'admin' && (
            <div className="card">
              <h2 className="text-sm font-semibold text-timber-900">Orders by status</h2>
              <p className="mt-1 text-xs text-timber-400">Current pipeline snapshot</p>
              <ul className="mt-5 space-y-3">
                {statusEntries.length === 0 && (
                  <li className="text-sm text-timber-400">No order data yet</li>
                )}
                {statusEntries.map(([status, count]) => (
                  <li key={status}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <span className={orderStatusBadge[status]}>
                        {orderStatusLabel[status] || status}
                      </span>
                      <span className="font-medium tabular-nums text-timber-800">{count}</span>
                    </div>
                    <div className="h-1 overflow-hidden bg-timber-100">
                      <div
                        className="h-full bg-timber-900 transition-all"
                        style={{ width: `${(count / statusTotal) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {finance?.lowStock?.length > 0 && (
            <div className="card">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-timber-900">Low stock</h2>
                <Link
                  to="/staff/products"
                  className="text-[10px] font-medium uppercase tracking-[0.16em] text-timber-500 hover:text-timber-900"
                >
                  Manage
                </Link>
              </div>
              <ul className="space-y-3">
                {finance.lowStock.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-timber-700">{p.name}</span>
                    <span className="shrink-0 font-medium tabular-nums text-timber-900">
                      {p.stock} left
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {user.role === 'ops' && (
            <div className="card">
              <h2 className="text-sm font-semibold text-timber-900">Ops focus</h2>
              <p className="mt-2 text-sm leading-relaxed text-timber-500">
                Confirm new orders, update delivery status, and close problem tickets from the
                fulfillment pages.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/staff/deliveries" className="btn-wheat btn-sm">
                  Open deliveries
                </Link>
                <Link to="/staff/problems" className="btn-outline btn-sm">
                  Problems
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
