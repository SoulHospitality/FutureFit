import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Truck } from 'lucide-react';
import api from '../../api/axios';
import { formatMoney } from '../../utils/helpers';
import { loadShippingConfig } from '../../utils/shipping';

const errMsg = (err) => err.response?.data?.message || 'Something went wrong';

const STATUS = {
  matched: null,
  new: ['bg-sky-100 text-sky-800', 'New on Bosta'],
  no_dropoff: ['bg-zinc-200 text-zinc-700', "Bosta doesn't deliver here"],
};

const when = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

/** Staff → Shipping: the delivery price for every governorate, lined up with Bosta's list. */
export default function StaffShipping() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [defaultFee, setDefaultFee] = useState(180);
  const [bosta, setBosta] = useState(null);
  const [notOnBosta, setNotOnBosta] = useState([]);
  const [syncedAt, setSyncedAt] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [bulk, setBulk] = useState('');
  const [q, setQ] = useState('');

  const load = () => {
    setLoading(true);
    return api
      .get('/shipping/admin')
      .then(({ data }) => {
        const settings = data.settings || {};
        const b = data.bosta || {};
        setBosta(b);
        setDefaultFee(settings.defaultFee ?? 180);
        setSyncedAt(settings.bostaSyncedAt || null);
        if (b.available) {
          setRows(b.rows || []);
          setNotOnBosta(b.notOnBosta || []);
          // Bosta added or dropped a governorate since the last save
          setDirty(Boolean((b.rows || []).some((r) => r.status === 'new') || (b.notOnBosta || []).length));
        } else {
          setRows((settings.destinations || []).map((d) => ({ ...d, status: 'matched' })));
          setNotOnBosta([]);
          setDirty(false);
        }
      })
      .catch((err) => toast.error(errMsg(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const update = (i, patch) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const applyBulk = () => {
    const n = Number(bulk);
    if (bulk === '' || !Number.isFinite(n) || n < 0) return toast.error('Enter a price first');
    setRows((prev) => prev.map((r) => (r.status === 'no_dropoff' ? r : { ...r, fee: n })));
    setDirty(true);
  };

  const save = async () => {
    const bad = rows.find((r) => r.fee === '' || !Number.isFinite(Number(r.fee)) || Number(r.fee) < 0);
    if (bad) return toast.error(`Enter a price for ${bad.name}`);
    setSaving(true);
    try {
      await api.put('/shipping/admin', {
        defaultFee: Number(defaultFee),
        alignedWithBosta: Boolean(bosta?.available),
        bostaSyncedAt: syncedAt,
        destinations: rows.map((r) => ({
          name: r.name,
          fee: Number(r.fee),
          enabled: r.enabled !== false,
          bostaCityId: r.bostaCityId || null,
          bostaName: r.bostaName || null,
          bostaNameAr: r.bostaNameAr || null,
        })),
      });
      toast.success('Shipping prices saved');
      loadShippingConfig({ force: true });
      await load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => !query || [r.name, r.bostaName, r.bostaNameAr].some((n) => String(n || '').toLowerCase().includes(query)));
  }, [rows, q]);

  const open = rows.filter((r) => r.enabled !== false);
  const fees = open.map((r) => Number(r.fee)).filter(Number.isFinite);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 text-white">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="page-title">Shipping</h1>
            <p className="page-subtitle">Delivery price for each governorate · same list Bosta delivers to</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Check Bosta again
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {dirty ? 'Save changes' : 'Save'}
          </button>
        </div>
      </div>

      {bosta && !loading && (
        bosta.available ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Lined up with Bosta&apos;s {bosta.count} governorates. Checkout shows exactly these
              destinations (the ones switched on).
              {syncedAt ? <span className="block text-xs text-emerald-800/80">Last saved against Bosta: {when(syncedAt)}</span> : null}
              {dirty && (rows.some((r) => r.status === 'new') || notOnBosta.length) ? (
                <span className="mt-1 block text-xs font-semibold">
                  Bosta&apos;s list changed since the last save — check the highlighted rows, then Save.
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Couldn&apos;t check against Bosta right now: {bosta.reason} Showing the saved list — prices
              still work; use “Check Bosta again” later to line the list up.
            </div>
          </div>
        )
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <div className="sp-metric">
          <p className="text-xs text-zinc-500">Open destinations</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{loading ? '…' : `${open.length} / ${rows.length}`}</p>
        </div>
        <div className="sp-metric">
          <p className="text-xs text-zinc-500">Cheapest</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{fees.length ? formatMoney(Math.min(...fees)) : '—'}</p>
        </div>
        <div className="sp-metric">
          <p className="text-xs text-zinc-500">Most expensive</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{fees.length ? formatMoney(Math.max(...fees)) : '—'}</p>
        </div>
        <div className="sp-metric">
          <p className="text-xs text-zinc-500">Free shipping</p>
          <Link to="/staff/promotions" className="mt-1 block text-sm font-medium text-zinc-800 hover:underline">
            Set dates & amount in Promotions →
          </Link>
        </div>
      </div>

      <div className="sp-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
          <input
            className="min-w-[180px] flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm sm:max-w-xs"
            placeholder="Search governorate…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Set all to</span>
            <input
              type="number"
              min={0}
              className="w-24 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
              placeholder="EGP"
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
            />
            <button type="button" onClick={applyBulk} className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-50">
              Apply
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Governorate</th>
                <th>On Bosta as</th>
                <th>Shipping price (EGP)</th>
                <th>Open for delivery</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-sm text-zinc-400">
                    Checking Bosta&apos;s governorates…
                  </td>
                </tr>
              )}
              {!loading &&
                shown.map(({ r, i }) => {
                  const badge = STATUS[r.status];
                  const blocked = r.status === 'no_dropoff';
                  return (
                    <tr key={r.bostaCityId || r.name} className={r.status === 'new' ? 'bg-sky-50/60' : r.enabled === false ? 'opacity-60' : ''}>
                      <td className="font-medium text-zinc-900">
                        {r.name}
                        {badge && (
                          <span className={`ms-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge[0]}`}>{badge[1]}</span>
                        )}
                      </td>
                      <td className="text-xs text-zinc-500">
                        {r.bostaName || '—'}
                        {r.bostaNameAr ? <span className="ms-1.5" dir="rtl">{r.bostaNameAr}</span> : null}
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          className="w-28 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm tabular-nums"
                          value={r.fee}
                          onChange={(e) => update(i, { fee: e.target.value })}
                        />
                      </td>
                      <td>
                        <label className={`inline-flex items-center gap-2 text-sm ${blocked ? 'text-zinc-400' : ''}`}>
                          <input
                            type="checkbox"
                            disabled={blocked}
                            checked={r.enabled !== false}
                            onChange={(e) => update(i, { enabled: e.target.checked })}
                          />
                          {r.enabled !== false ? 'Open' : 'Closed'}
                        </label>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 px-4 py-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-zinc-600">Any other destination</span>
            <input
              type="number"
              min={0}
              className="w-24 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
              value={defaultFee}
              onChange={(e) => {
                setDefaultFee(e.target.value);
                setDirty(true);
              }}
            />
            <span className="text-zinc-400">EGP</span>
          </label>
          <span className="text-xs text-zinc-400">
            Only used if an order comes in for a governorate that isn&apos;t listed above.
          </span>
        </div>
      </div>

      {notOnBosta.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-semibold">Not on Bosta&apos;s list: {notOnBosta.map((d) => d.name).join(', ')}</p>
          <p className="mt-0.5 text-xs text-red-800/80">
            Bosta can&apos;t ship to these, so they come off checkout when you save.
          </p>
        </div>
      )}
    </>
  );
}
