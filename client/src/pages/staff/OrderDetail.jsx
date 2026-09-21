import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  ExternalLink,
  MessageCircle,
  Printer,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import api from '../../api/axios';
import {
  deliveryStatusMeta,
  formatMoney,
  formatStaffDate,
  getImageUrl,
  isBostaSynced,
  isCodPayment,
  orderStatusLabel,
  paymentStatusMeta,
  fulfillmentStatusMeta,
} from '../../utils/helpers';

const NEXT = {
  pending: ['confirmed', 'canceled'],
  confirmed: ['out_for_delivery', 'canceled', 'problem'],
  out_for_delivery: ['delivered', 'problem', 'canceled'],
  problem: ['confirmed', 'out_for_delivery', 'canceled'],
  delivered: [],
  canceled: [],
};

function waLink(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const normalized = digits.startsWith('0') ? `20${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

export default function StaffOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [problem, setProblem] = useState({ subject: '', details: '' });

  const load = () =>
    api.get(`/orders/${id}`).then((r) => setOrder(r.data));

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => {
        toast.error('Order not found');
        navigate('/staff/orders', { replace: true });
      })
      .finally(() => setLoading(false));
  }, [id]);

  const markPaid = async () => {
    setBusy('paid');
    try {
      const { data } = await api.patch(`/orders/${id}/paid`, { isPaid: true });
      setOrder(data);
      toast.success(
        data.bostaTrackingNumber
          ? `Payment captured · Bosta ${data.bostaTrackingNumber}`
          : 'Payment captured'
      );
    } catch (err) {
      const payload = err.response?.data;
      if (payload?.order) setOrder(payload.order);
      toast.error(payload?.message || 'Failed');
    } finally {
      setBusy('');
    }
  };

  const setStatus = async (status) => {
    setBusy(status);
    try {
      const { data } = await api.patch(`/orders/${id}/status`, { status });
      setOrder(data);
      toast.success(`Marked ${orderStatusLabel[status]}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setBusy('');
    }
  };

  const retryBosta = async () => {
    setBusy('bosta');
    try {
      const { data } = await api.post(`/bosta/orders/${id}/ship`, {
        shippingAddress: {
          state: order.shippingAddress?.state || 'Cairo',
          city: order.shippingAddress?.city || 'New Cairo',
          country: order.shippingAddress?.country || 'Egypt',
          street: order.shippingAddress?.street,
        },
      });
      setOrder((prev) => ({ ...prev, ...data }));
      toast.success(data.bostaTrackingNumber ? `Bosta · ${data.bostaTrackingNumber}` : 'Bosta synced');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bosta sync failed');
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this order permanently?')) return;
    setBusy('delete');
    try {
      await api.delete(`/orders/${id}`);
      toast.success('Order deleted');
      navigate('/staff/orders', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
      setBusy('');
    }
  };

  const fileProblem = async (e) => {
    e.preventDefault();
    if (!problem.subject.trim()) return toast.error('Subject required');
    setBusy('problem');
    try {
      await api.post('/problems', {
        orderId: id,
        subject: problem.subject.trim(),
        details: problem.details.trim() || problem.subject.trim(),
      });
      toast.success('Problem filed');
      setProblem({ subject: '', details: '' });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create problem');
    } finally {
      setBusy('');
    }
  };

  if (loading || !order) {
    return (
      <div className="sp-card h-64 animate-pulse bg-zinc-100" />
    );
  }

  const pay = paymentStatusMeta(order);
  const fulfill = fulfillmentStatusMeta(order);
  const delivery = deliveryStatusMeta(order);
  const addr = order.shippingAddress || {};
  const phone = order.customerPhone || order.user?.phone || order.guestPhone;
  const name = order.customerName || order.user?.name || order.guestName || 'Guest';
  const wa = waLink(
    phone,
    `Hi ${name.split(' ')[0] || ''}, this is FutureFit about order #${order.id.slice(0, 8)}.`
  );

  const timeline = [
    { label: 'Order placed', at: order.createdAt, done: true },
    {
      label: 'Confirmed',
      at: order.status !== 'pending' && order.status !== 'canceled' ? order.updatedAt : null,
      done: !['pending', 'canceled'].includes(order.status),
    },
    {
      label: 'Payment',
      at: order.paidAt,
      done: order.isPaid,
    },
    {
      label: 'Bosta shipment',
      at: isBostaSynced(order) ? order.updatedAt : null,
      done: isBostaSynced(order),
    },
    {
      label: 'Out for delivery',
      at: null,
      done: ['out_for_delivery', 'delivered'].includes(order.status),
    },
    {
      label: 'Delivered',
      at: order.deliveredAt,
      done: order.status === 'delivered',
    },
  ];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link
          to="/staff/orders"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" /> Orders
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="page-title !text-2xl">#{order.id.slice(0, 8)}</h1>
          <p className="page-subtitle !mt-0.5">{formatStaffDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 print:hidden"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <span className={pay.className}>{pay.label}</span>
          <span className={fulfill.className}>{fulfill.label}</span>
          <span className={delivery.className}>{delivery.label}</span>
          {isBostaSynced(order) && <span className="sp-tag">bosta_synced</span>}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="sp-card p-5">
            <h2 className="text-sm font-semibold text-zinc-900">Items</h2>
            <ul className="mt-4 divide-y divide-zinc-100">
              {(order.items || []).map((item) => (
                <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                    {item.image ? (
                      <img
                        src={getImageUrl(item.image, { width: 112 })}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900">{item.name}</p>
                    <p className="text-xs text-zinc-500">
                      {[item.color, item.size].filter(Boolean).join(' · ') || '—'}
                      {' · '}
                      Qty {item.qty}
                    </p>
                  </div>
                  <p className="shrink-0 tabular-nums text-sm font-medium">
                    {formatMoney(Number(item.price) * item.qty)}
                  </p>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1.5 border-t border-zinc-100 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Subtotal</dt>
                <dd className="tabular-nums">{formatMoney(order.itemsPrice)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Shipping</dt>
                <dd className="tabular-nums">{formatMoney(order.shippingPrice)}</dd>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Discount {order.couponCode ? `(${order.couponCode})` : ''}</dt>
                  <dd className="tabular-nums text-emerald-700">
                    −{formatMoney(order.discountAmount)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t border-zinc-100 pt-2 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(order.totalPrice)}</dd>
              </div>
            </dl>
          </div>

          <div className="sp-card p-5">
            <h2 className="text-sm font-semibold text-zinc-900">Timeline</h2>
            <ol className="mt-4 space-y-3">
              {timeline.map((t) => (
                <li key={t.label} className="flex items-start gap-3 text-sm">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      t.done ? 'bg-zinc-900' : 'bg-zinc-200'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={t.done ? 'font-medium text-zinc-900' : 'text-zinc-400'}>
                      {t.label}
                    </p>
                    {t.at && (
                      <p className="text-xs text-zinc-400">{formatStaffDate(t.at)}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {(order.problems || []).length > 0 && (
            <div className="sp-card p-5">
              <h2 className="text-sm font-semibold text-zinc-900">Problems</h2>
              <ul className="mt-3 space-y-2">
                {order.problems.map((p) => (
                  <li key={p.id} className="rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                    <p className="font-medium">{p.subject}</p>
                    <p className="text-xs capitalize text-zinc-500">{p.status.replace('_', ' ')}</p>
                  </li>
                ))}
              </ul>
              <Link to="/staff/problems" className="mt-3 inline-block text-xs font-medium text-zinc-600">
                Open problems →
              </Link>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="sp-card p-5">
            <h2 className="text-sm font-semibold text-zinc-900">Customer</h2>
            <p className="mt-2 font-medium text-zinc-900">{name}</p>
            {phone && <p className="text-sm text-zinc-600">{phone}</p>}
            {(order.customerEmail || order.user?.email || order.guestEmail) && (
              <p className="text-sm text-zinc-500">
                {order.customerEmail || order.user?.email || order.guestEmail}
              </p>
            )}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
            <div className="mt-4 border-t border-zinc-100 pt-4 text-sm text-zinc-600">
              <p className="font-medium text-zinc-800">Shipping address</p>
              <p className="mt-1">{addr.street || '—'}</p>
              <p>
                {[addr.city, addr.state, addr.zip].filter(Boolean).join(', ')}
              </p>
              <p>{addr.country || 'Egypt'}</p>
            </div>
          </div>

          <div className="sp-card p-5">
            <h2 className="text-sm font-semibold text-zinc-900">Payment</h2>
            <p className="mt-2 text-sm text-zinc-600">{order.paymentMethod}</p>
            <div className="mt-2">
              <span className={pay.className}>{pay.label}</span>
            </div>
            {isCodPayment(order) && !order.isPaid && (
              <p className="mt-2 text-xs text-zinc-500">
                COD is marked paid automatically when Bosta reports delivered. No Capture needed —
                shipment starts when the order is placed.
              </p>
            )}
            {!order.isPaid && order.status !== 'canceled' && !isCodPayment(order) && (
              <button
                type="button"
                disabled={busy === 'paid'}
                onClick={markPaid}
                className="mt-3 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                Capture payment
              </button>
            )}
          </div>

          <div className="sp-card p-5">
            <h2 className="text-sm font-semibold text-zinc-900">Fulfillment · Bosta</h2>
            {isBostaSynced(order) ? (
              <div className="mt-2 space-y-1 text-sm">
                <p className="font-mono text-zinc-800">{order.bostaTrackingNumber || 'Synced'}</p>
                {order.shippingStatus && (
                  <p className="text-xs text-zinc-500">Status: {order.shippingStatus}</p>
                )}
                {order.bostaTrackingNumber && (
                  <a
                    href={`https://bosta.co/en-eg/tracking-shipments?shipment-number=${order.bostaTrackingNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                  >
                    Track on Bosta <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ) : (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="font-medium">Not on Bosta yet</p>
                <p className="mt-0.5 text-xs text-amber-800/80">
                  {order.isPaid || isCodPayment(order)
                    ? 'Tap Retry Bosta sync to create the shipment. Check the phone number if it fails.'
                    : 'Capture payment first for prepaid orders, or use Retry if this is COD.'}
                </p>
              </div>
            )}
            {!isBostaSynced(order) && order.status !== 'canceled' && (
              <button
                type="button"
                disabled={busy === 'bosta'}
                onClick={retryBosta}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {busy === 'bosta' ? 'Syncing…' : 'Retry Bosta sync'}
              </button>
            )}
            <div className="mt-3 flex flex-wrap gap-1">
              {(NEXT[order.status] || []).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!!busy}
                  onClick={() => setStatus(s)}
                  className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50"
                >
                  {orderStatusLabel[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="sp-card p-5">
            <h2 className="text-sm font-semibold text-zinc-900">File a problem</h2>
            <form onSubmit={fileProblem} className="mt-3 space-y-2">
              <input
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                placeholder="Subject"
                value={problem.subject}
                onChange={(e) => setProblem({ ...problem, subject: e.target.value })}
              />
              <textarea
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                rows={3}
                placeholder="Details"
                value={problem.details}
                onChange={(e) => setProblem({ ...problem, details: e.target.value })}
              />
              <button
                type="submit"
                disabled={busy === 'problem'}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium hover:bg-zinc-50"
              >
                Create problem
              </button>
            </form>
          </div>

          <button
            type="button"
            onClick={remove}
            disabled={busy === 'delete'}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> Delete order
          </button>
        </div>
      </div>
    </>
  );
}
