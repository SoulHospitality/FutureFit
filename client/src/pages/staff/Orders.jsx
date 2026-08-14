import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Trash2 } from 'lucide-react';
import api from '../../api/axios';
import { formatMoney, orderStatusBadge, orderStatusLabel } from '../../utils/helpers';

export default function StaffOrders() {
  const [orders, setOrders] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [markingId, setMarkingId] = useState(null);

  const load = () => api.get('/orders').then((r) => setOrders(r.data));

  useEffect(() => {
    load();
  }, []);

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

  return (
    <>
      <div className="mb-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-timber-400">
          Fulfillment
        </p>
        <h1 className="mt-1 page-title">Orders</h1>
        <p className="page-subtitle">
          Full essentials order list — mark payments when received
        </p>
      </div>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Paid</th>
              <th>Status</th>
              <th>Date</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="font-mono text-xs">{o.id.slice(0, 8)}</td>
                <td>{o.customerName || o.user?.name || o.guestName || 'Guest'}</td>
                <td className="tabular-nums">{o.items?.length || 0}</td>
                <td className="tabular-nums">{formatMoney(o.totalPrice)}</td>
                <td>{o.paymentMethod}</td>
                <td>
                  <span className={o.isPaid ? 'badge-green' : 'badge-yellow'}>
                    {o.isPaid ? 'Paid' : 'Unpaid'}
                  </span>
                </td>
                <td>
                  <span className={orderStatusBadge[o.status]}>{orderStatusLabel[o.status]}</span>
                </td>
                <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="flex flex-wrap items-center justify-end gap-1">
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
                  No orders yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
