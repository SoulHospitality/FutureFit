import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AlertTriangle, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import {
  asArray,
  deliveryStatusMeta,
  formatMoney,
  formatStaffDate,
  isBostaSynced,
  isCodPayment,
  orderStatusLabel,
  paymentStatusMeta,
} from '../../utils/helpers';

function addressLines(addr) {
  if (!addr || typeof addr !== 'object') return { street: '', area: '', country: '' };
  const street = String(addr.street || '').trim();
  const area = [addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
  const country = addr.country && String(addr.country).trim() !== 'Egypt' ? String(addr.country).trim() : '';
  return { street, area, country };
}

function AddressCell({ address }) {
  const { street, area, country } = addressLines(address);
  if (!street && !area) return '—';
  const full = [street, area, country].filter(Boolean).join(' · ');
  return (
    <div className="space-y-0.5 text-xs leading-snug" title={full}>
      {street ? <p className="font-medium text-zinc-800">{street}</p> : null}
      {area ? <p className="text-zinc-500">{area}</p> : null}
      {country ? <p className="text-zinc-400">{country}</p> : null}
    </div>
  );
}

/** Matches MAX_AUTO_ATTEMPTS on the server: after this many failed tries an order is flagged. */
const BOSTA_MAX_TRIES = 3;

const awaitingBosta = (o) =>
  !isBostaSynced(o) && !['canceled', 'delivered'].includes(o.status);

const isBostaFlagged = (o) => awaitingBosta(o) && (o.bostaSyncAttempts || 0) >= BOSTA_MAX_TRIES;

const isBostaRetrying = (o) =>
  awaitingBosta(o) && Boolean(o.bostaSyncError) && (o.bostaSyncAttempts || 0) > 0 && !isBostaFlagged(o);

/** A timed-out or unclear answer: the shipment might already exist on Bosta. */
const mayBeOnBosta = (o) =>
  /did not answer within|without a tracking number/i.test(String(o.bostaSyncError || ''));

/** What happens next for a flagged order, in plain words. */
function flaggedHint(o) {
  if (mayBeOnBosta(o)) {
    return 'Bosta may have created this shipment without confirming it. Check the Bosta dashboard first — it will not be retried automatically, so it can’t ship twice.';
  }
  if (o.bostaSyncRetryable === false) {
    return 'Bosta rejected the details. Fix them on the order (Edit customer) — saving starts 3 new automatic tries.';
  }
  return 'Still retrying automatically every 30 minutes. If it keeps failing, check the details on the order.';
}

function FailedSyncPanel({ orders }) {
  if (!orders.length) return null;
  return (
    <div className="mb-5 overflow-hidden rounded-xl border-2 border-red-500 bg-red-50 shadow-sm">
      <div className="flex items-start gap-3 bg-red-600 px-4 py-3 text-white">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
        <div>
          <p className="text-sm font-semibold">
            {orders.length} order{orders.length === 1 ? '' : 's'} failed to sync with Bosta {BOSTA_MAX_TRIES} times
          </p>
          <p className="text-xs text-red-100">These are not on Bosta yet and need attention.</p>
        </div>
      </div>
      <ul className="divide-y divide-red-200">
        {orders.map((o) => (
          <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-900">
                <Link to={`/staff/orders/${o.id}`} className="hover:underline">
                  #{o.id.slice(0, 8)}
                </Link>
                <span className="font-normal text-red-800">
                  {' '}
                  · {o.customerName || o.user?.name || o.guestName || 'Guest'} ·{' '}
                  {o.customerPhone || o.guestPhone || '—'} · {formatMoney(o.totalPrice)}
                </span>
              </p>
              <p className="mt-1 break-words text-xs font-medium text-red-700">
                {o.bostaSyncError || 'Bosta sync failed'}
              </p>
              <p className="mt-1 text-xs text-red-800/80">{flaggedHint(o)}</p>
            </div>
            <div className="shrink-0 text-right text-[11px] text-red-800/80">
              <p>{o.bostaSyncAttempts} tries</p>
              {o.bostaLastAttemptAt ? <p>Last: {formatStaffDate(o.bostaLastAttemptAt)}</p> : null}
              <Link
                to={`/staff/orders/${o.id}`}
                className="mt-1.5 inline-block rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
              >
                Open order
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

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

  // Load every order so the failed-sync list is complete whatever the filter;
  // refresh each minute to pick up the automatic retries.
  const load = () => api.get('/orders').then((r) => setOrders(asArray(r.data)));

  useEffect(() => {
    load();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') load().catch(() => {});
    }, 60 * 1000);
    return () => window.clearInterval(t);
  }, []);

  const shown = filter ? orders.filter((o) => o.status === filter) : orders;
  const flagged = orders.filter(isBostaFlagged);

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
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Deliveries</h1>
          <p className="page-subtitle">
            Bosta tracking and status — shipments create automatically when orders confirm, and
            failed syncs retry on their own
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

      <FailedSyncPanel orders={flagged} />

      <div className="sp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Delivery</th>
                <th>Tracking</th>
                <th>Tags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => {
                const pay = paymentStatusMeta(o);
                const delivery = deliveryStatusMeta(o);
                return (
                  <tr
                    key={o.id}
                    className={isBostaFlagged(o) ? 'bg-red-50 shadow-[inset_3px_0_0_#dc2626]' : ''}
                  >
                    <td className="font-medium text-zinc-900">
                      <Link to={`/staff/orders/${o.id}`} className="hover:underline">
                        #{o.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="text-zinc-500">{formatStaffDate(o.createdAt)}</td>
                    <td>{o.customerName || o.user?.name || o.guestName || 'Guest'}</td>
                    <td>{o.customerPhone || o.user?.phone || o.guestPhone || '—'}</td>
                    <td className="min-w-[220px] max-w-[320px] !whitespace-normal text-zinc-700">
                      <AddressCell address={o.shippingAddress} />
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
                      ) : isBostaFlagged(o) ? (
                        <span
                          className="inline-flex rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white"
                          title={o.bostaSyncError || ''}
                        >
                          Bosta failed
                        </span>
                      ) : isBostaRetrying(o) ? (
                        <span
                          className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                          title={o.bostaSyncError || ''}
                        >
                          Retrying {o.bostaSyncAttempts}/{BOSTA_MAX_TRIES}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1">
                        {!o.isPaid && o.status !== 'canceled' && !isCodPayment(o) && (
                          <button
                            type="button"
                            className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                            disabled={markingId === o.id}
                            onClick={() => markPaid(o)}
                          >
                            Capture
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
              {shown.length === 0 && (
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
