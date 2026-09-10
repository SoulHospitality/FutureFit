import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Search, Users } from 'lucide-react';
import api from '../../api/axios';
import { asArray, formatMoney, formatStaffDate } from '../../utils/helpers';

function waLink(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const normalized = digits.startsWith('0') ? `20${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}`;
}

export default function StaffCustomers() {
  const [data, setData] = useState({ customers: [], summary: null });
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get('/analytics/customers')
      .then((r) => setData(r.data || { customers: [], summary: null }))
      .catch(() => setData({ customers: [], summary: null }))
      .finally(() => setLoading(false));
  }, []);

  const customers = asArray(data.customers);

  const filtered = useMemo(() => {
    let list = customers;
    if (tab === 'returning') list = list.filter((c) => c.returning);
    if (tab === 'new') list = list.filter((c) => !c.returning);
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((c) =>
        [c.name, c.phone, c.email, c.city].filter(Boolean).join(' ').toLowerCase().includes(query)
      );
    }
    return list;
  }, [customers, q, tab]);

  const s = data.summary;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 text-white">
            <Users className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="page-title">Customers</h1>
            <p className="page-subtitle">From store orders · Egypt</p>
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="sp-metric">
          <p className="text-xs text-zinc-500">Customers</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{s?.total ?? '—'}</p>
        </div>
        <div className="sp-metric">
          <p className="text-xs text-zinc-500">Returning</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{s?.returning ?? '—'}</p>
        </div>
        <div className="sp-metric">
          <p className="text-xs text-zinc-500">Returning rate</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {s ? `${s.returningRate.toFixed(0)}%` : '—'}
          </p>
        </div>
      </div>

      <div className="sp-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2.5 sm:px-4">
          {[
            ['all', 'All'],
            ['returning', 'Returning'],
            ['new', 'New'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {label}
            </button>
          ))}
          <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-sm focus:border-zinc-400 focus:outline-none"
              placeholder="Search customers"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Location</th>
                <th>Orders</th>
                <th>Total spent</th>
                <th>Last order</th>
                <th>Tags</th>
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
              {filtered.map((c) => {
                const wa = waLink(c.phone);
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="font-medium text-zinc-900">{c.name}</div>
                      <div className="text-xs text-zinc-400">{c.phone || c.email || '—'}</div>
                    </td>
                    <td className="text-zinc-500">{c.city || '—'}</td>
                    <td className="tabular-nums">{c.orders}</td>
                    <td className="tabular-nums font-medium">{formatMoney(c.totalSpent)}</td>
                    <td className="text-zinc-500">
                      {c.lastOrderAt ? formatStaffDate(c.lastOrderAt) : '—'}
                    </td>
                    <td>
                      {c.returning ? (
                        <span className="sp-tag">returning</span>
                      ) : (
                        <span className="sp-tag">new</span>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                            title="WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        )}
                        <Link
                          to={`/staff/orders?q=${encodeURIComponent(c.phone || c.email || c.name)}`}
                          className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50"
                        >
                          Orders
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-zinc-400">
                    No customers yet
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
