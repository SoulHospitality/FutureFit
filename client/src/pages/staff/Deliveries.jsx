import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Trash2 } from 'lucide-react';
import api from '../../api/axios';
import { formatMoney, orderStatusBadge, orderStatusLabel, asArray } from '../../utils/helpers';

const NEXT = {
  pending: ['confirmed', 'canceled'],
  confirmed: ['out_for_delivery', 'canceled', 'problem'],
  out_for_delivery: ['delivered', 'problem', 'canceled'],
  problem: ['confirmed', 'out_for_delivery', 'canceled'],
  delivered: [],
  canceled: [],
};

export default function StaffDeliveries() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [markingId, setMarkingId] = useState(null);

  const load = () =>
    api
      .get('/orders' + (filter ? `?status=${filter}` : ''))
      .then((r) => setOrders(asArray(r.data)));

  useEffect(() => {
    load();
  }, [filter]);

  const setStatus = async (id, status) => {
    try {
      await api.patch(`/orders/${id}/status`, { status });
      toast.success(`Marked ${orderStatusLabel[status]}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const markPaid = async (order) => {
    setMarkingId(order.id);
    try {
      const { data } = await api.patch(`/orders/${order.id}/paid`, { isPaid: true });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? data : o)));
      toast.success('Marked as paid');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not mark paid');
    } finally {
      setMarkingId(null);
    }
  };

  const remove = async (order) => {
    const label = order.id.slice(0, 8);
    if (!window.confirm(`Delete order ${label}? This cannot be undone.`)) return;
    setDeletingId(order.id);
    try {
      await api.delete(`/orders/${order.id}`);
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      toast.success('Order deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-timber-400">
            Fulfillment
          </p>
          <h1 className="mt-1 page-title">Deliveries</h1>
          <p className="page-subtitle">Track packs out for delivery and confirm payment</p>
        </div>
        <select className="input w-48" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {Object.keys(orderStatusLabel).map((s) => (
            <option key={s} value={s}>
              {orderStatusLabel[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Paid</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="font-mono text-xs">{o.id.slice(0, 8)}</td>
                <td>{o.customerName || o.user?.name || o.guestName || 'Guest'}</td>
                <td>{o.customerPhone || o.user?.phone || o.guestPhone || '—'}</td>
                <td className="max-w-[180px] truncate">
                  {o.shippingAddress?.city}, {o.shippingAddress?.street}
                </td>
                <td className="tabular-nums">{formatMoney(o.totalPrice)}</td>
                <td className="text-sm">{o.paymentMethod}</td>
                <td>
                  <span className={o.isPaid ? 'badge-green' : 'badge-yellow'}>
                    {o.isPaid ? 'Paid' : 'Unpaid'}
                  </span>
                </td>
                <td>
                  <span className={orderStatusBadge[o.status]}>{orderStatusLabel[o.status]}</span>
                </td>
                <td>
                  <div className="flex flex-wrap items-center gap-1">
                    {!o.isPaid && o.status !== 'canceled' && (
                      <button
                        type="button"
                        className="btn-outline btn-sm"
                        disabled={markingId === o.id}
                        onClick={() => markPaid(o)}
                      >
                        Mark paid
                      </button>
                    )}
                    {(NEXT[o.status] || []).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="btn-outline btn-sm"
                        onClick={() => setStatus(o.id, s)}
                      >
                        {orderStatusLabel[s]}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                      title="Delete order"
                      disabled={deletingId === o.id}
                      onClick={() => remove(o)}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-sm text-timber-400">
                  No deliveries to show
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
