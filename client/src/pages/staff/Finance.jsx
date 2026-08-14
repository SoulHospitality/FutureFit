import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Wallet,
  ShoppingBag,
  Package,
  CircleDollarSign,
  TrendingDown,
  Download,
  Pencil,
  Trash2,
  Plus,
} from 'lucide-react';
import api from '../../api/axios';
import StatCard from '../../components/ui/StatCard';
import Modal from '../../components/ui/Modal';
import {
  formatMoney,
  orderStatusBadge,
  orderStatusLabel,
  EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  asArray,
} from '../../utils/helpers';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders' },
  { id: 'expenses', label: 'Expenses' },
];

const emptyExpenseForm = () => ({
  category: 'packaging',
  description: '',
  amount: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  notes: '',
});

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename, headers, rows) {
  const lines = [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StaffFinance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'overview';

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState(null);

  const [expenseModal, setExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [savingExpense, setSavingExpense] = useState(false);

  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    api
      .get(`/orders/finance?${q}`)
      .then((r) => setData(r.data))
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load finance'))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const orders = asArray(data?.orders);
  const expenses = asArray(data?.expenses);

  const markPaid = async (orderId) => {
    setMarkingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/paid`, { isPaid: true });
      toast.success('Marked as paid');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not mark paid');
    } finally {
      setMarkingId(null);
    }
  };

  const exportOrders = () => {
    downloadCsv(
      `futurefit-orders-${from || 'all'}-${to || 'all'}.csv`,
      ['id', 'date', 'customer', 'paymentMethod', 'status', 'total', 'isPaid', 'paidAt'],
      orders.map((o) => [
        o.id,
        o.createdAt,
        o.customerName || o.user?.name || o.guestName || 'Guest',
        o.paymentMethod,
        o.status,
        o.totalPrice,
        o.isPaid ? 'yes' : 'no',
        o.paidAt || '',
      ])
    );
  };

  const exportExpenses = () => {
    downloadCsv(
      `futurefit-expenses-${from || 'all'}-${to || 'all'}.csv`,
      ['id', 'date', 'category', 'description', 'amount', 'notes'],
      expenses.map((e) => [
        e.id,
        e.expenseDate,
        e.category,
        e.description,
        e.amount,
        e.notes || '',
      ])
    );
  };

  const openCreateExpense = () => {
    setEditingExpense(null);
    setExpenseForm(emptyExpenseForm());
    setExpenseModal(true);
  };

  const openEditExpense = (expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      category: expense.category,
      description: expense.description,
      amount: String(expense.amount),
      expenseDate: new Date(expense.expenseDate).toISOString().slice(0, 10),
      notes: expense.notes || '',
    });
    setExpenseModal(true);
  };

  const saveExpense = async (e) => {
    e.preventDefault();
    setSavingExpense(true);
    const payload = {
      category: expenseForm.category,
      description: expenseForm.description.trim(),
      amount: Number(expenseForm.amount),
      expenseDate: expenseForm.expenseDate,
      notes: expenseForm.notes.trim() || null,
    };
    try {
      if (editingExpense) {
        await api.put(`/expenses/${editingExpense.id}`, payload);
        toast.success('Expense updated');
      } else {
        await api.post('/expenses', payload);
        toast.success('Expense added');
      }
      setExpenseModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSavingExpense(false);
    }
  };

  const removeExpense = async (expense) => {
    if (!window.confirm(`Delete expense “${expense.description}”?`)) return;
    try {
      await api.delete(`/expenses/${expense.id}`);
      toast.success('Expense deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const rangeLabel = useMemo(() => {
    if (!from && !to) return 'All time';
    return `${from || '…'} → ${to || '…'}`;
  }, [from, to]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-timber-400">
            Admin
          </p>
          <h1 className="mt-1 page-title">Finance</h1>
          <p className="page-subtitle">
            Essentials revenue, collected cash, and operating costs
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={exportOrders}
            disabled={!orders.length}
          >
            <Download className="mr-1 h-3.5 w-3.5" strokeWidth={1.5} />
            Orders CSV
          </button>
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={exportExpenses}
            disabled={!expenses.length}
          >
            <Download className="mr-1 h-3.5 w-3.5" strokeWidth={1.5} />
            Expenses CSV
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">From</label>
          <input
            type="date"
            className="input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button type="button" className="btn-dark" onClick={load}>
          Apply
        </button>
        <p className="pb-2 text-xs text-timber-400">{rangeLabel}</p>
      </div>

      <div className="mb-6 flex gap-1 border-b border-timber-100">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-timber-900 text-timber-900'
                : 'border-transparent text-timber-500 hover:text-timber-800'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <p className="text-sm text-timber-400">Loading…</p>
      ) : data ? (
        <>
          {tab === 'overview' && (
            <OverviewTab data={data} onMarkPaid={markPaid} markingId={markingId} />
          )}
          {tab === 'orders' && (
            <OrdersTab orders={orders} onMarkPaid={markPaid} markingId={markingId} />
          )}
          {tab === 'expenses' && (
            <ExpensesTab
              expenses={expenses}
              onAdd={openCreateExpense}
              onEdit={openEditExpense}
              onDelete={removeExpense}
            />
          )}
        </>
      ) : null}

      <Modal
        open={expenseModal}
        onClose={() => setExpenseModal(false)}
        title={editingExpense ? 'Edit expense' : 'Add expense'}
      >
        <form className="space-y-4" onSubmit={saveExpense}>
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={expenseForm.category}
              onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}
              required
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <input
              className="input"
              placeholder="e.g. Poly mailers, fabric sample run"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount (EGP)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="input"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                className="input"
                value={expenseForm.expenseDate}
                onChange={(e) => setExpenseForm((f) => ({ ...f, expenseDate: e.target.value }))}
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input min-h-[80px]"
              value={expenseForm.notes}
              onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setExpenseModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-dark" disabled={savingExpense}>
              {savingExpense ? 'Saving…' : editingExpense ? 'Update' : 'Add expense'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function OverviewTab({ data, onMarkPaid, markingId }) {
  const paymentRows = Array.isArray(data.byPaymentMethod)
    ? data.byPaymentMethod
    : Object.entries(data.byPaymentMethod || {}).map(([method, count]) => ({
        method,
        count: Number(count) || 0,
        revenue: 0,
        paid: 0,
        outstanding: 0,
      }));
  const expenseCategories = asArray(data.byExpenseCategory);
  const recentOrders = asArray(data.recentOrders);

  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Gross revenue" value={formatMoney(data.revenue)} icon={Wallet} tone="wheat" />
        <StatCard title="Collected" value={formatMoney(data.paid)} icon={ShoppingBag} tone="green" />
        <StatCard
          title="Outstanding"
          value={formatMoney(data.outstanding)}
          icon={CircleDollarSign}
          tone="red"
        />
        <StatCard
          title="Expenses"
          value={formatMoney(data.expensesTotal ?? 0)}
          icon={TrendingDown}
          tone="muted"
        />
        <StatCard
          title="Net cash"
          value={formatMoney(data.netCash ?? data.paid - (data.expensesTotal || 0))}
          icon={Package}
          tone="green"
        />
      </div>

      <div className="mb-8 grid gap-4 text-sm sm:grid-cols-3">
        <div className="card flex justify-between">
          <span className="text-timber-500">Catalog sales</span>
          <span className="font-semibold tabular-nums">{formatMoney(data.itemsTotal ?? 0)}</span>
        </div>
        <div className="card flex justify-between">
          <span className="text-timber-500">Shipping</span>
          <span className="font-semibold tabular-nums">{formatMoney(data.shippingTotal ?? 0)}</span>
        </div>
        <div className="card flex justify-between">
          <span className="text-timber-500">Discounts</span>
          <span className="font-semibold tabular-nums">{formatMoney(data.discountTotal ?? 0)}</span>
        </div>
      </div>

      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="text-sm font-semibold text-timber-900">By payment method</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>Collected</th>
                  <th>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.map((row) => (
                  <tr key={row.method}>
                    <td>{row.method}</td>
                    <td className="tabular-nums">{row.count}</td>
                    <td className="tabular-nums">{formatMoney(row.revenue)}</td>
                    <td className="tabular-nums">{formatMoney(row.paid)}</td>
                    <td className="tabular-nums">{formatMoney(row.outstanding)}</td>
                  </tr>
                ))}
                {!paymentRows.length && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-timber-400">
                      No orders in range
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-timber-900">By status</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {Object.entries(data.byStatus || {}).map(([k, v]) => (
              <li key={k} className="flex justify-between gap-3">
                <span className={orderStatusBadge[k]}>{orderStatusLabel[k]}</span>
                <span className="font-medium tabular-nums">{v}</span>
              </li>
            ))}
            {!Object.keys(data.byStatus || {}).length && (
              <li className="text-sm text-timber-400">No orders in range</li>
            )}
          </ul>

          {expenseCategories.length > 0 && (
            <>
              <h2 className="mt-8 text-sm font-semibold text-timber-900">Expenses by category</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {expenseCategories.map((row) => (
                  <li key={row.category} className="flex justify-between gap-3">
                    <span className="text-timber-700">{expenseCategoryLabel(row.category)}</span>
                    <span className="font-medium tabular-nums">{formatMoney(row.total)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-timber-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-timber-900">Recent orders</h2>
          <p className="text-xs text-timber-400">Mark COD / transfer payments when received</p>
        </div>
        <div className="table-wrapper !rounded-none !border-0">
          <table className="table text-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>Method</th>
                <th>Status</th>
                <th>Total</th>
                <th>Paid</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id}>
                  <td className="font-mono text-xs">{o.id.slice(0, 8)}</td>
                  <td>{o.paymentMethod}</td>
                  <td>
                    <span className={orderStatusBadge[o.status]}>{orderStatusLabel[o.status]}</span>
                  </td>
                  <td className="tabular-nums">{formatMoney(o.totalPrice)}</td>
                  <td>
                    <span className={o.isPaid ? 'badge-green' : 'badge-yellow'}>
                      {o.isPaid ? 'Paid' : 'Unpaid'}
                    </span>
                  </td>
                  <td>
                    {!o.isPaid && o.status !== 'canceled' && (
                      <button
                        type="button"
                        className="btn-outline btn-sm"
                        disabled={markingId === o.id}
                        onClick={() => onMarkPaid(o.id)}
                      >
                        Mark paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!recentOrders.length && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-timber-400">
                    No orders
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

function OrdersTab({ orders, onMarkPaid, markingId }) {
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="border-b border-timber-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-timber-900">Orders in range</h2>
        <p className="text-xs text-timber-400">{orders.length} records</p>
      </div>
      <div className="table-wrapper !rounded-none !border-0">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Total</th>
              <th>Paid</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="font-mono text-xs">{o.id.slice(0, 8)}</td>
                <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                <td>{o.customerName || o.user?.name || o.guestName || 'Guest'}</td>
                <td>{o.paymentMethod}</td>
                <td>
                  <span className={orderStatusBadge[o.status]}>{orderStatusLabel[o.status]}</span>
                </td>
                <td className="tabular-nums">{formatMoney(o.totalPrice)}</td>
                <td>
                  <span className={o.isPaid ? 'badge-green' : 'badge-yellow'}>
                    {o.isPaid ? 'Paid' : 'Unpaid'}
                  </span>
                </td>
                <td>
                  {!o.isPaid && o.status !== 'canceled' && (
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      disabled={markingId === o.id}
                      onClick={() => onMarkPaid(o.id)}
                    >
                      Mark paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-timber-400">
                  No orders in this range
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpensesTab({ expenses, onAdd, onEdit, onDelete }) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-timber-500">
          Track packaging, fabric, ads, and other costs against collected cash.
        </p>
        <button type="button" className="btn-dark btn-sm" onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" strokeWidth={1.5} />
          Add expense
        </button>
      </div>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.expenseDate).toLocaleDateString()}</td>
                <td>{expenseCategoryLabel(e.category)}</td>
                <td>{e.description}</td>
                <td className="tabular-nums">{formatMoney(e.amount)}</td>
                <td className="max-w-[160px] truncate text-timber-500">{e.notes || '—'}</td>
                <td>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      title="Edit"
                      onClick={() => onEdit(e)}
                    >
                      <Pencil className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                      title="Delete"
                      onClick={() => onDelete(e)}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-timber-400">
                  No expenses in this range
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
