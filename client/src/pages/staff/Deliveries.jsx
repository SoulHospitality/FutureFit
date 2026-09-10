import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { RefreshCw, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import {
  asArray,
  deliveryStatusMeta,
  formatMoney,
  formatStaffDate,
  isBostaSynced,
  orderStatusLabel,
  paymentStatusMeta,
} from '../../utils/helpers';

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
  const [shippingId, setShippingId] = useState(null);

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

  /** Manual retry only — primary path is auto-sync on confirm/payment */
  const retryBosta = async (order) => {
    setShippingId(order.id);
    try {
      const { data } = await api.post(`/bosta/orders/${order.id}/ship`);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? {
                ...o,
                ...data,
                bostaTrackingNumber: data.bostaTrackingNumber || o.bostaTrackingNumber,
                shippingCarrier: data.shippingCarrier || 'bosta',
              }
            : o
        )
      );
      toast.success(
        data.bostaTrackingNumber
          ? `Bosta synced · ${data.bostaTrackingNumber}`
          : 'Bosta synced'
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bosta sync failed');
    } finally {
      setShippingId(null);
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
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Deliveries</h1>
          <p className="page-subtitle">
            Bosta tracking and status — shipments create automatically when orders confirm
          </p>
        </div>
        <select
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {Object.keys(orderStatusLabel).map((s) => (
            <option key={s} value={s}>
              {orderStatusLabel[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="sp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Region</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Delivery</th>
                <th>Tracking</th>
                <th>Tags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const pay = paymentStatusMeta(o);
                const delivery = deliveryStatusMeta(o);
                return (
                  <tr key={o.id}>
                    <td className="font-medium text-zinc-900">
                      <Link to={`/staff/orders/${o.id}`} className="hover:underline">
                        #{o.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="text-zinc-500">{formatStaffDate(o.createdAt)}</td>
                    <td>{o.customerName || o.user?.name || o.guestName || 'Guest'}</td>
                    <td>{o.customerPhone || o.user?.phone || o.guestPhone || '—'}</td>
                    <td className="max-w-[160px] truncate text-zinc-500">
                      {o.shippingAddress?.city || 'Egypt'}
                    </td>
                    <td className="tabular-nums">{formatMoney(o.totalPrice)}</td>
                    <td>
                      <span className={pay.className}>{pay.label}</span>
                    </td>
                    <td>
                      <span className={delivery.className}>{delivery.label}</span>
                    </td>
                    <td className="font-mono text-xs text-zinc-700">
                      {o.bostaTrackingNumber || '—'}
                    </td>
                    <td>
                      {isBostaSynced(o) ? (
                        <span className="sp-tag">bosta_synced</span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1">
                        {!o.isPaid && o.status !== 'canceled' && (
                          <button
                            type="button"
                            className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                            disabled={markingId === o.id}
                            onClick={() => markPaid(o)}
                          >
                            Capture
                          </button>
                        )}
                        {!isBostaSynced(o) &&
                          o.status !== 'canceled' &&
                          o.status !== 'delivered' && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                              disabled={shippingId === o.id}
                              onClick={() => retryBosta(o)}
                              title="Retry Bosta sync (only if auto-sync failed)"
                            >
                              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
                              {shippingId === o.id ? 'Syncing…' : 'Retry sync'}
                            </button>
                          )}
                        {(NEXT[o.status] || []).map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                            onClick={() => setStatus(o.id, s)}
                          >
                            {orderStatusLabel[s]}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete order"
                          disabled={deletingId === o.id}
                          onClick={() => remove(o)}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-sm text-zinc-400">
                    No deliveries to show
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
