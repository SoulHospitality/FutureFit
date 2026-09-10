import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize2, Minus, Plus, Search } from 'lucide-react';
import api from '../../api/axios';
import Sparkline from '../../components/staff/Sparkline';
import { formatMoney } from '../../utils/helpers';

/** Project lat/lng onto a simple Egypt-centered flat map (SVG). */
function project(lat, lng, w, h) {
  // Bounds roughly covering Egypt + nearby
  const minLat = 21.5;
  const maxLat = 32.5;
  const minLng = 24.5;
  const maxLng = 37;
  const x = ((lng - minLng) / (maxLng - minLng)) * w;
  const y = ((maxLat - lat) / (maxLat - minLat)) * h;
  return { x, y };
}

function LiveMap({ pins, zoom }) {
  const w = 720;
  const h = 520;
  const cx = w / 2;
  const cy = h / 2;
  const scale = zoom;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full rounded-xl bg-[#eef3f7]">
      <defs>
        <pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.1" fill="#c5d4e0" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill="url(#dots)" />
      {/* Soft land silhouette suggestion */}
      <ellipse
        cx={cx}
        cy={cy + 20}
        rx={210 * scale}
        ry={260 * scale}
        fill="#dbe7f0"
        opacity="0.85"
      />
      <g transform={`translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`}>
        {pins.map((p) => {
          const { x, y } = project(p.lat || 26.8, p.lng || 30.8, w, h);
          const color = p.type === 'order' ? '#7c3aed' : '#2563eb';
          return (
            <g key={p.id}>
              <circle cx={x} cy={y} r="10" fill={color} opacity="0.18" />
              <circle cx={x} cy={y} r="4.5" fill={color} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default function StaffLiveView() {
  const [data, setData] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () =>
    api.get('/analytics/live').then((r) => setData(r.data));

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load()
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    const id = setInterval(() => {
      load().catch(() => {});
    }, 20000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const pins = useMemo(() => {
    const list = data?.pins || [];
    if (!q.trim()) return list;
    const needle = q.trim().toLowerCase();
    return list.filter((p) =>
      [p.label, p.path, p.orderId].filter(Boolean).join(' ').toLowerCase().includes(needle)
    );
  }, [data, q]);

  const maxLoc = Math.max(...(data?.sessionsByLocation || []).map((l) => l.count), 1);
  const updated = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-4 xl:flex-row">
      {/* Left metrics column */}
      <div className="flex w-full shrink-0 flex-col gap-3 xl:w-[340px]">
        <div className="flex items-center gap-2">
          <h1 className="page-title !text-xl">Live View</h1>
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-600" />
          </span>
          <span className="text-xs text-zinc-400">Just now · {updated}</span>
        </div>

        <div className="sp-card p-4">
          <p className="text-xs font-medium text-zinc-500">Visitors right now</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900">
            {loading ? '…' : data?.visitorsRightNow ?? 0}
          </p>
        </div>

        <div className="sp-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-zinc-500">Total sales</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {formatMoney(data?.totalSalesToday || 0)}
              </p>
            </div>
            <Sparkline values={data?.series?.sales || []} className="h-8 w-20" />
          </div>
        </div>

        <div className="sp-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-zinc-500">Sessions</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {data?.sessionsToday ?? 0}
              </p>
            </div>
            <Sparkline values={data?.series?.sessions || []} className="h-8 w-20" />
          </div>
        </div>

        <div className="sp-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-zinc-500">Orders</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{data?.ordersToday ?? 0}</p>
            </div>
            <Sparkline values={data?.series?.orders || []} className="h-8 w-20" />
          </div>
        </div>

        <div className="sp-card p-4">
          <p className="mb-3 text-xs font-medium text-zinc-500">Customer behavior</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['Active carts', data?.customerBehavior?.activeCarts],
              ['Checking out', data?.customerBehavior?.checkingOut],
              ['Purchased', data?.customerBehavior?.purchased],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-zinc-50 px-2 py-3">
                <p className="text-lg font-semibold tabular-nums text-zinc-900">{value ?? 0}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-zinc-500">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="sp-card p-4">
          <p className="mb-3 text-xs font-medium text-zinc-500">New vs returning</p>
          {(data?.ordersToday ?? 0) === 0 ? (
            <p className="text-sm text-zinc-400">No data for this data range</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-zinc-50 px-2 py-3">
                <p className="text-lg font-semibold tabular-nums">{data?.newVsReturning?.new ?? 0}</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">New</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-2 py-3">
                <p className="text-lg font-semibold tabular-nums">
                  {data?.newVsReturning?.returning ?? 0}
                </p>
                <p className="mt-0.5 text-[10px] text-zinc-500">Returning</p>
              </div>
            </div>
          )}
        </div>

        <div className="sp-card p-4">
          <p className="mb-3 text-xs font-medium text-zinc-500">Sessions by location</p>
          <ul className="space-y-2.5">
            {(data?.sessionsByLocation || []).slice(0, 6).map((l) => (
              <li key={l.label}>
                <div className="mb-1 flex justify-between gap-2 text-xs">
                  <span className="truncate text-zinc-600">{l.label}</span>
                  <span className="tabular-nums">{l.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${(l.count / maxLoc) * 100}%` }}
                  />
                </div>
              </li>
            ))}
            {!data?.sessionsByLocation?.length && (
              <li className="text-sm text-zinc-400">No data for this range</li>
            )}
          </ul>
        </div>

        <Link to="/staff/analytics" className="text-xs font-medium text-zinc-500 hover:text-zinc-800">
          Open Analytics →
        </Link>
      </div>

      {/* Map pane */}
      <div className="sp-card relative min-h-[420px] flex-1 overflow-hidden p-0">
        <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              className="w-full rounded-lg border border-zinc-200 bg-white/95 py-2 pl-9 pr-3 text-sm shadow-sm backdrop-blur"
              placeholder="Search location"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 bg-white shadow-sm"
            title="Fullscreen"
            onClick={() => {
              const el = document.documentElement;
              if (!document.fullscreenElement) el.requestFullscreen?.();
              else document.exitFullscreen?.();
            }}
          >
            <Maximize2 className="h-4 w-4 text-zinc-600" />
          </button>
        </div>

        <div className="absolute inset-0">
          <LiveMap pins={pins} zoom={zoom} />
        </div>

        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-200 bg-white shadow-sm"
            onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-200 bg-white shadow-sm"
            onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>

        <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-zinc-200 bg-white/95 px-3 py-2 text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-600" /> Orders
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Visitors right now
          </div>
        </div>
      </div>
    </div>
  );
}
