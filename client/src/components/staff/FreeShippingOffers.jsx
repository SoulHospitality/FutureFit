import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Megaphone, Pencil, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../ui/Modal';
import { asArray, formatMoney } from '../../utils/helpers';
import { loadShippingConfig } from '../../utils/shipping';

const errMsg = (err) => err.response?.data?.message || 'Something went wrong';

/** ISO → value for <input type="datetime-local"> in the viewer's time zone. */
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);

const when = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

const defaultText = (amount) =>
  `Free shipping on orders over EGP ${new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(
    Number(amount) || 0
  )}`;

const emptyForm = () => ({
  name: 'Free shipping',
  minSubtotal: 2000,
  startsAt: toLocalInput(new Date().toISOString()),
  endsAt: '',
  showAnnouncement: true,
  announcementText: '',
  isActive: true,
});

const STATE_BADGE = {
  live: ['badge-green', 'Running now'],
  scheduled: ['badge-gray', 'Scheduled'],
  ended: ['badge-gray', 'Ended'],
  off: ['badge-gray', 'Off'],
};

/** Staff → Promotions → Free shipping: dated free-shipping offers with an optional announcement. */
export default function FreeShippingOffers() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api
      .get('/shipping/free-offers')
      .then((r) => setOffers(asArray(r.data)))
      .catch((err) => toast.error(errMsg(err)))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const refreshStore = () => loadShippingConfig({ force: true });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (o) => {
    setEditing(o);
    setForm({
      name: o.name,
      minSubtotal: o.minSubtotal,
      startsAt: toLocalInput(o.startsAt),
      endsAt: toLocalInput(o.endsAt),
      showAnnouncement: o.showAnnouncement,
      announcementText: o.announcementText || '',
      isActive: o.isActive,
    });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (form.endsAt && form.startsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
      toast.error('The end date must be after the start date');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        minSubtotal: Number(form.minSubtotal),
        startsAt: fromLocalInput(form.startsAt),
        endsAt: fromLocalInput(form.endsAt),
      };
      if (editing) await api.put(`/shipping/free-offers/${editing.id}`, payload);
      else await api.post('/shipping/free-offers', payload);
      toast.success(editing ? 'Free shipping offer updated' : 'Free shipping offer created');
      setOpen(false);
      load();
      refreshStore();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (o) => {
    try {
      await api.put(`/shipping/free-offers/${o.id}`, { isActive: !o.isActive });
      load();
      refreshStore();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const remove = async (o) => {
    if (!window.confirm(`Delete "${o.name}"?`)) return;
    try {
      await api.delete(`/shipping/free-offers/${o.id}`);
      load();
      refreshStore();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const running = offers.find((o) => o.live);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-zinc-500">
          Free shipping when the order total reaches an amount, between the dates you choose. Totals are
          what the customer pays for the items, after offers and promo codes. With no offer running,
          every order pays the shipping price for its governorate (Staff → Shipping).
        </p>
        <button type="button" className="btn-wheat" onClick={openNew}>
          Add free shipping offer
        </button>
      </div>

      <div
        className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
          running ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-zinc-200 bg-zinc-50 text-zinc-600'
        }`}
      >
        {running ? (
          <>
            <strong>{running.name}</strong> is running: free shipping on orders over{' '}
            {formatMoney(running.minSubtotal)}
            {running.endsAt ? ` until ${when(running.endsAt)}` : ''}.
            {running.showAnnouncement && (
              <span className="mt-1 flex items-center gap-1.5 text-xs">
                <Megaphone className="h-3.5 w-3.5" /> Announcement bar: “
                {running.announcementText || defaultText(running.minSubtotal)}”
              </span>
            )}
          </>
        ) : (
          'No free shipping right now — customers pay shipping on every order.'
        )}
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Offer</th>
              <th>Free over</th>
              <th>Starts</th>
              <th>Ends</th>
              <th>Announcement</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => {
              const [cls, label] = STATE_BADGE[o.state] || STATE_BADGE.off;
              return (
                <tr key={o.id}>
                  <td className="font-medium text-zinc-900">{o.name}</td>
                  <td className="tabular-nums">{formatMoney(o.minSubtotal)}</td>
                  <td className="whitespace-nowrap text-zinc-600">{when(o.startsAt)}</td>
                  <td className="whitespace-nowrap text-zinc-600">{o.endsAt ? when(o.endsAt) : 'No end date'}</td>
                  <td className="max-w-[260px] truncate text-xs text-zinc-500">
                    {o.showAnnouncement ? o.announcementText || defaultText(o.minSubtotal) : '—'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={cls}
                      onClick={() => toggle(o)}
                      title={o.isActive ? 'Click to switch off' : 'Click to switch on'}
                    >
                      {label}
                    </button>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(o)} aria-label="Edit offer">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm text-red-600"
                        onClick={() => remove(o)}
                        aria-label="Delete offer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && !offers.length && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-zinc-400">
                  No free shipping offers yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit free shipping offer' : 'New free shipping offer'}
      >
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label" htmlFor="fs-name">Name (staff only)</label>
            <input
              id="fs-name"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="fs-min">Free shipping when the order total reaches (EGP)</label>
            <input
              id="fs-min"
              required
              type="number"
              min={0}
              step="1"
              className="input"
              value={form.minSubtotal}
              onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })}
            />
            <p className="mt-1 text-xs text-timber-500">Use 0 for free shipping on every order.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="fs-start">Starts</label>
              <input
                id="fs-start"
                required
                type="datetime-local"
                className="input"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="fs-end">Ends (optional)</label>
              <input
                id="fs-end"
                type="datetime-local"
                className="input"
                min={form.startsAt || undefined}
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.showAnnouncement}
                onChange={(e) => setForm({ ...form, showAnnouncement: e.target.checked })}
              />
              Show in the announcement bar while it runs
            </label>
            {form.showAnnouncement && (
              <div className="mt-2.5">
                <label className="label" htmlFor="fs-text">Announcement text</label>
                <input
                  id="fs-text"
                  maxLength={140}
                  className="input"
                  placeholder={defaultText(form.minSubtotal)}
                  value={form.announcementText}
                  onChange={(e) => setForm({ ...form, announcementText: e.target.value })}
                />
                <p className="mt-1 text-xs text-timber-500">
                  Leave empty to use “{defaultText(form.minSubtotal)}”. It shows first in the bar, and
                  disappears when the offer ends.
                </p>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
          <button type="submit" className="btn-wheat w-full" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save offer' : 'Create offer'}
          </button>
        </form>
      </Modal>
    </>
  );
}
