import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Download, Search, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import {
  asArray,
  deliveryStatusMeta,
  formatMoney,
  formatStaffDate,
  fulfillmentStatusMeta,
  isBostaSynced,
  paymentStatusMeta,
} from '../../utils/helpers';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'unfulfilled', label: 'Unfulfilled' },
  { id: 'open', label: 'Open' },
  { id: 'delivered', label: 'Delivered' },
];

export default function StaffOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'all';
  const [orders, setOrders] = useState([]);
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api.get('/orders').then((r) => setOrders(asArray(r.data)));

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const fromUrl = searchParams.get('q') || '';
    if (fromUrl && fromUrl !== q) setQ(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filtered = useMemo(() => {
    let list = orders;
    if (tab === 'unpaid') {
      list = list.filter((o) => !o.isPaid && o.status !== 'canceled');
    } else if (tab === 'unfulfilled') {
      list = list.filter(
        (o) =>
          o.status !== 'canceled' &&
          o.status !== 'delivered' &&
          (!isBostaSynced(o) || o.status === 'pending')
      );
    } else if (tab === 'open') {
      list = list.filter((o) =>
        ['pending', 'confirmed', 'out_for_delivery', 'problem'].includes(o.status)
      );
    } else if (tab === 'delivered') {
      list = list.filter((o) => o.status === 'delivered');
    }
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((o) => {
        const hay = [
          o.id,
          o.customerName,
          o.user?.name,
          o.guestName,
          o.customerPhone,
          o.user?.phone,
          o.guestPhone,
          o.customerEmail,
          o.bostaTrackingNumber,
          o.paymentMethod,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(query);
      });
    }
    return list;
  }, [orders, tab, q]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((o) => selected.has(o.id));

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((o) => next.delete(o.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((o) => next.add(o.id));
        return next;
      });
    }
  };

  const selectedOrders = orders.filter((o) => selected.has(o.id));

  const bulkCapture = async () => {
    const unpaid = selectedOrders.filter((o) => !o.isPaid && o.status !== 'canceled');
    if (!unpaid.length) return toast.info('No unpaid orders selected');
    setBusy(true);
    let ok = 0;
    try {
      for (const o of unpaid) {
        const { data } = await api.patch(`/orders/${o.id}/paid`, { isPaid: true });
        setOrders((prev) => prev.map((x) => (x.id === o.id ? data : x)));
        ok += 1;
      }
      toast.success(`Captured ${ok} payment${ok === 1 ? '' : 's'}`);
      setSelected(new Set());
    } catch (err) {
      toast.error(err.response?.data?.message || `Stopped after ${ok} captures`);
    } finally {
      setBusy(false);
    }
  };

  const bulkExport = (list = selectedOrders.length ? selectedOrders : filtered) => {
    const header = [
      'Order',
      'Date',
      'Customer',
      'Phone',
      'Total',
      'Payment',
      'Paid',
      'Status',
      'Bosta',
      'Items',
    ];
    const lines = list.map((o) =>
      [
        o.id,
        o.createdAt,
        o.customerName || o.user?.name || o.guestName || '',
        o.customerPhone || o.user?.phone || o.guestPhone || '',
        o.totalPrice,
        o.paymentMethod,
        o.isPaid ? 'yes' : 'no',
        o.status,
        o.bostaTrackingNumber || '',
        (o.items || []).reduce((n, i) => n + (i.qty || 0), 0),
      ]
        .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const remove = async (order, e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (!window.confirm(`Delete order ${order.id.slice(0, 8)}?`)) return;
    try {
      await api.delete(`/orders/${order.id}`);
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
      toast.success('Order deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const markPaid = async (order, e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    try {
      const { data } = await api.patch(`/orders/${order.id}/paid`, { isPaid: true });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? data : o)));
      toast.success('Marked as paid');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not mark paid');
    }
  };

  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'all') next.delete('tab');
    else next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">
            Confirmed orders sync to Bosta automatically — no manual shipment create
          </p>
        </div>
        <button
          type="button"
          onClick={() => bulkExport(filtered)}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          <Download className="h-4 w-4" /> Export view
        </button>
      </div>

      <div className="sp-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2.5 sm:px-4">
          <div className="flex flex-wrap items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  tab === t.id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-zinc-400 focus:outline-none"
              placeholder="Search and filter"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-2.5 text-sm">
            <span className="font-medium text-zinc-800">{selected.size} selected</span>
            <button
              type="button"
              disabled={busy}
              onClick={bulkCapture}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Capture payments
            </button>
            <button
              type="button"
              onClick={() => bulkExport()}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium"
            >
              Export selected
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-zinc-500 hover:text-zinc-800"
            >
              Clear
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th>Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Channel</th>
                <th>Total</th>
                <th>Payment status</th>
                <th>Fulfillment</th>
                <th>Delivery</th>
                <th>Items</th>
                <th>Tags</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-sm text-zinc-400">
                    Loading orders…
                  </td>
                </tr>
              )}
              {filtered.map((o) => {
                const pay = paymentStatusMeta(o);
                const fulfill = fulfillmentStatusMeta(o);
                const delivery = deliveryStatusMeta(o);
                const itemCount = (o.items || []).reduce((n, i) => n + (i.qty || 0), 0);
                const voided = o.status === 'canceled';
                return (
                  <tr key={o.id} className={voided ? 'opacity-50' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(o.id)}
                        onChange={() => toggleOne(o.id)}
                        aria-label={`Select ${o.id.slice(0, 8)}`}
                      />
                    </td>
                    <td className={`font-medium text-zinc-900 ${voided ? 'line-through' : ''}`}>
                      <Link to={`/staff/orders/${o.id}`} className="hover:underline">
                        #{o.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="text-zinc-500">{formatStaffDate(o.createdAt)}</td>
                    <td className={voided ? 'line-through' : ''}>
                      <Link to={`/staff/orders/${o.id}`} className="hover:underline">
                        {o.customerName || o.user?.name || o.guestName || o.guestPhone || 'Guest'}
                      </Link>
                    </td>
                    <td className="text-zinc-500">Online Store</td>
                    <td className={`tabular-nums ${voided ? 'line-through' : ''}`}>
                      {formatMoney(voided ? 0 : o.totalPrice)}
                    </td>
                    <td>
                      <span className={pay.className}>{pay.label}</span>
                    </td>
                    <td>
                      <span className={fulfill.className}>{fulfill.label}</span>
                    </td>
                    <td>
                      <span className={delivery.className}>{delivery.label}</span>
                    </td>
                    <td className="text-zinc-500">
                      {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {isBostaSynced(o) && <span className="sp-tag">bosta_synced</span>}
                        {o.paymentMethod && (
                          <span className="sp-tag">
                            {String(o.paymentMethod).includes('Paymob')
                              ? 'paymob'
                              : String(o.paymentMethod).toLowerCase().includes('cash')
                                ? 'cod'
                                : String(o.paymentMethod).toLowerCase()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {!o.isPaid && !voided && (
                          <button
                            type="button"
                            className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50"
                            onClick={(e) => markPaid(o, e)}
                          >
                            Capture
                          </button>
                        )}
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                          onClick={(e) => remove(o, e)}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-sm text-zinc-400">
                    No orders match this filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-zinc-100 px-4 py-2.5 text-xs text-zinc-400">
          {filtered.length} of {orders.length} orders
        </div>
      </div>
    </>
  );
}
