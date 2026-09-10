import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Download, MessageCircle, Search, ShoppingCart } from 'lucide-react';
import api from '../../api/axios';
import { asArray, formatMoney, formatStaffDate } from '../../utils/helpers';

function recoveryMessage(row) {
  const name = row.guestName ? String(row.guestName).split(' ')[0] : '';
  const items = (row.cartItems || [])
    .slice(0, 3)
    .map((i) => i.name)
    .filter(Boolean)
    .join(', ');
  return `Hi${name ? ` ${name}` : ''}, you left ${items || 'items'} in your FutureFit bag (EGP ${Math.round(Number(row.subtotal) || 0)}). Ready to finish checkout? ${typeof window !== 'undefined' ? window.location.origin : ''}/cart`;
}

function waLink(phone, message) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const normalized = digits.startsWith('0') ? `20${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function mailLink(email, message) {
  if (!email) return null;
  return `mailto:${email}?subject=${encodeURIComponent('Complete your FutureFit order')}&body=${encodeURIComponent(message)}`;
}

export default function StaffAbandoned() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () =>
    api.get('/analytics/abandoned', { params: { status: 'incomplete' } }).then((r) => {
      setRows(asArray(r.data));
    });

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) => {
      const hay = [
        r.id,
        r.guestName,
        r.guestPhone,
        r.guestEmail,
        r.shippingAddress?.city,
        r.shippingAddress?.country,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
  }, [rows, q]);

  const markRecovered = async (row) => {
    try {
      const { data } = await api.patch(`/analytics/abandoned/${row.id}/recovered`);
      setRows((prev) => prev.map((r) => (r.id === row.id ? data : r)));
      toast.success('Marked recovered');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const remove = async (row) => {
    if (!window.confirm('Delete this abandoned checkout?')) return;
    try {
      await api.delete(`/analytics/abandoned/${row.id}`);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success('Deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const exportCsv = () => {
    const header = ['Checkout', 'Created', 'Customer', 'Region', 'Status', 'Total'];
    const lines = filtered.map((r) =>
      [
        r.id.slice(0, 12),
        new Date(r.updatedAt).toISOString(),
        r.guestName || r.guestPhone || r.guestEmail || '',
        r.shippingAddress?.country || 'Egypt',
        r.recoveryStatus,
        r.subtotal,
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'abandoned-checkouts.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 text-white">
            <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="page-title">Abandoned checkouts</h1>
            <p className="page-subtitle">Incomplete · carts left before payment</p>
          </div>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="sp-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2.5 sm:px-4">
          <button
            type="button"
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            All
          </button>
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

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Checkout</th>
                <th>Created</th>
                <th>Customer name</th>
                <th>Region</th>
                <th>Recovery status</th>
                <th>Total price</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-zinc-400">
                    Loading…
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const customer =
                  r.guestName || r.guestPhone || r.guestEmail || 'Guest';
                const recovered = r.recoveryStatus === 'recovered';
                return (
                  <tr key={r.id}>
                    <td className="font-medium text-zinc-900">#{r.id.replace(/-/g, '').slice(0, 14)}</td>
                    <td className="text-zinc-500">{formatStaffDate(r.updatedAt || r.createdAt)}</td>
                    <td>
                      <div>{customer}</div>
                      {r.guestPhone && r.guestName && (
                        <div className="text-xs text-zinc-400">{r.guestPhone}</div>
                      )}
                    </td>
                    <td className="text-zinc-500">
                      {r.shippingAddress?.country || 'Egypt'}
                    </td>
                    <td>
                      <span
                        className={`sp-pill ${
                          recovered ? 'sp-pill-ok' : 'sp-pill-pending'
                        }`}
                      >
                        {recovered ? 'Recovered' : 'Not recovered'}
                      </span>
                    </td>
                    <td className="tabular-nums">{formatMoney(r.subtotal)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {waLink(r.guestPhone, recoveryMessage(r)) && (
                          <a
                            href={waLink(r.guestPhone, recoveryMessage(r))}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                            title="WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        )}
                        {mailLink(r.guestEmail, recoveryMessage(r)) && (
                          <a
                            href={mailLink(r.guestEmail, recoveryMessage(r))}
                            className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium hover:bg-zinc-50"
                            title="Email"
                          >
                            Email
                          </a>
                        )}
                        <button
                          type="button"
                          className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium hover:bg-zinc-50"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(recoveryMessage(r));
                              toast.success('Recovery message copied');
                            } catch {
                              toast.error('Copy failed');
                            }
                          }}
                        >
                          Copy
                        </button>
                        {!recovered && (
                          <button
                            type="button"
                            className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50"
                            onClick={() => markRecovered(r)}
                          >
                            Mark recovered
                          </button>
                        )}
                        <button
                          type="button"
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          onClick={() => remove(r)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-zinc-400">
                    No abandoned checkouts
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-zinc-100 px-4 py-2.5 text-xs text-zinc-400">
          {filtered.length} checkouts
        </div>
      </div>
    </>
  );
}
