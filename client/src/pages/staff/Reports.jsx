import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pin, Search } from 'lucide-react';

const REPORTS = [
  {
    id: 'sales-over-time',
    name: 'Total sales over time',
    category: 'Sales',
    to: '/staff/analytics',
    system: true,
  },
  {
    id: 'sales-breakdown',
    name: 'Total sales breakdown',
    category: 'Finances',
    to: '/staff/analytics',
    system: true,
  },
  {
    id: 'sales-by-product',
    name: 'Total sales by product',
    category: 'Sales',
    to: '/staff/analytics',
    system: true,
  },
  {
    id: 'sales-by-channel',
    name: 'Total sales by sales channel',
    category: 'Sales',
    to: '/staff/analytics',
    system: true,
  },
  {
    id: 'orders-list',
    name: 'Orders by payment & fulfillment',
    category: 'Orders',
    to: '/staff/orders',
    system: true,
  },
  {
    id: 'abandoned',
    name: 'Abandoned checkouts',
    category: 'Behavior',
    to: '/staff/abandoned',
    system: true,
  },
  {
    id: 'live',
    name: 'Live View — visitors & orders map',
    category: 'Behavior',
    to: '/staff/live',
    system: true,
  },
  {
    id: 'deliveries',
    name: 'Deliveries & Bosta tracking',
    category: 'Orders',
    to: '/staff/deliveries',
    system: true,
  },
  {
    id: 'finance',
    name: 'Finance P&L and expenses',
    category: 'Finances',
    to: '/staff/finance',
    system: true,
  },
  {
    id: 'customers-location',
    name: 'Customers by location',
    category: 'Customers',
    to: '/staff/customers',
    system: true,
  },
  {
    id: 'inventory',
    name: 'Inventory — low stock & out of stock',
    category: 'Inventory',
    to: '/staff/inventory',
    system: true,
  },
  {
    id: 'customers-list',
    name: 'Customers — new vs returning',
    category: 'Customers',
    to: '/staff/customers',
    system: true,
  },
];

const CATEGORIES = ['All', ...new Set(REPORTS.map((r) => r.category))];

export default function StaffReports() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All');
  const [pinned, setPinned] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ff_pinned_reports') || '[]');
    } catch {
      return [];
    }
  });

  const togglePin = (id) => {
    setPinned((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem('ff_pinned_reports', JSON.stringify(next));
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = REPORTS;
    if (category !== 'All') list = list.filter((r) => r.category === category);
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(query) || r.category.toLowerCase().includes(query)
      );
    }
    return [...list].sort((a, b) => {
      const ap = pinned.includes(a.id) ? 0 : 1;
      const bp = pinned.includes(b.id) ? 0 : 1;
      return ap - bp || a.name.localeCompare(b.name);
    });
  }, [q, category, pinned]);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Explore sales, orders, and customer behavior</p>
        </div>
        <Link
          to="/staff/analytics"
          className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          New exploration
        </Link>
      </div>

      <div className="sp-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-3 sm:px-4">
          <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-zinc-400 focus:outline-none"
              placeholder="Search reports"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c === 'All' ? 'Category' : c}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Last viewed</th>
                <th>Created by</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link
                      to={r.to}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td>
                    <span className="sp-tag">{r.category}</span>
                  </td>
                  <td className="text-zinc-500">—</td>
                  <td>
                    <span className="inline-flex items-center gap-2 text-sm text-zinc-600">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800">
                        FF
                      </span>
                      FutureFit
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`rounded-lg p-1.5 ${
                        pinned.includes(r.id)
                          ? 'text-zinc-900'
                          : 'text-zinc-300 hover:text-zinc-600'
                      }`}
                      onClick={() => togglePin(r.id)}
                      title="Pin report"
                    >
                      <Pin className="h-4 w-4" strokeWidth={pinned.includes(r.id) ? 2.25 : 1.5} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-zinc-400">
                    No reports match
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-zinc-100 px-4 py-2.5 text-xs text-zinc-400">
          1–{filtered.length} of {REPORTS.length}
        </div>
      </div>
    </>
  );
}
