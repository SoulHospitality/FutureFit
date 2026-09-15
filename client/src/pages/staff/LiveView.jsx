import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize2, Minus, Plus, Search } from 'lucide-react';
import api from '../../api/axios';
import Sparkline from '../../components/staff/Sparkline';
import { formatMoney } from '../../utils/helpers';

/** Simplified Egypt outline [lng, lat] — enough for an admin live map. */
const EGYPT_RING = [
  [25.0, 31.65],
  [26.5, 31.55],
  [28.0, 31.4],
  [29.5, 31.2],
  [30.8, 31.35],
  [31.5, 31.55],
  [32.3, 31.25],
  [32.95, 31.15],
  [33.9, 31.15],
  [34.2, 31.25],
  [34.5, 31.0],
  [34.35, 29.9],
  [34.55, 28.5],
  [34.8, 27.7],
  [34.4, 26.8],
  [34.9, 25.5],
  [35.5, 24.2],
  [36.9, 23.5],
  [36.85, 22.0],
  [33.0, 22.0],
  [29.5, 22.0],
  [25.0, 22.0],
  [24.7, 23.5],
  [24.7, 25.5],
  [24.9, 27.5],
  [24.7, 29.0],
  [24.9, 30.5],
  [25.0, 31.65],
];

/** Nile corridor hint [lng, lat]. */
const NILE = [
  [32.9, 22.2],
  [32.85, 24.0],
  [32.7, 25.5],
  [32.5, 26.5],
  [31.9, 27.5],
  [31.2, 28.2],
  [31.0, 29.0],
  [31.15, 29.8],
  [31.25, 30.5],
  [31.23, 31.25],
];

const MAP = {
  minLng: 24.2,
  maxLng: 37.2,
  minLat: 21.6,
  maxLat: 32.2,
  w: 900,
  h: 640,
};

function project(lat, lng) {
  const x = ((lng - MAP.minLng) / (MAP.maxLng - MAP.minLng)) * MAP.w;
  const y = ((MAP.maxLat - lat) / (MAP.maxLat - MAP.minLat)) * MAP.h;
  return { x, y };
}

function ringToPath(ring) {
  return ring
    .map(([lng, lat], i) => {
      const { x, y } = project(lat, lng);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function LiveMap({ pins, zoom, pan, onPanChange }) {
  const svgRef = useRef(null);
  const drag = useRef(null);
  const [hover, setHover] = useState(null);

  const egyptPath = useMemo(() => `${ringToPath(EGYPT_RING)} Z`, []);
  const nilePath = useMemo(() => ringToPath(NILE), []);

  const cx = MAP.w / 2;
  const cy = MAP.h / 2;

  const onPointerDown = (e) => {
    if (e.target.closest('[data-pin]')) return;
    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture?.(e.pointerId);
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const onPointerMove = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    onPanChange({
      x: drag.current.panX + dx,
      y: drag.current.panY + dy,
    });
  };

  const endDrag = (e) => {
    if (!drag.current) return;
    svgRef.current?.releasePointerCapture?.(e.pointerId);
    drag.current = null;
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${MAP.w} ${MAP.h}`}
      className="h-full w-full touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="img"
      aria-label="Live map of Egypt"
    >
      <defs>
        <linearGradient id="live-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#bfdbfe" />
        </linearGradient>
        <filter id="live-pin-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width={MAP.w} height={MAP.h} fill="url(#live-sea)" />

      <g
        transform={`translate(${cx + pan.x} ${cy + pan.y}) scale(${zoom}) translate(${-cx} ${-cy})`}
      >
        {/* Neighbor suggestion (soft) */}
        <rect
          x={0}
          y={0}
          width={MAP.w}
          height={MAP.h}
          fill="#e8eef4"
          opacity="0.35"
        />

        <path
          d={egyptPath}
          fill="#f8fafc"
          stroke="#94a3b8"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        <path
          d={nilePath}
          fill="none"
          stroke="#93c5fd"
          strokeWidth={5}
          strokeLinecap="round"
          opacity="0.75"
        />
        <path
          d={nilePath}
          fill="none"
          stroke="#60a5fa"
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* Grid of faint meridians for landscape read */}
        {[26, 28, 30, 32, 34, 36].map((lng) => {
          const a = project(MAP.maxLat, lng);
          const b = project(MAP.minLat, lng);
          return (
            <line
              key={`v-${lng}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#cbd5e1"
              strokeWidth="0.8"
              opacity="0.35"
            />
          );
        })}
        {[24, 26, 28, 30, 32].map((lat) => {
          const a = project(lat, MAP.minLng);
          const b = project(lat, MAP.maxLng);
          return (
            <line
              key={`h-${lat}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#cbd5e1"
              strokeWidth="0.8"
              opacity="0.35"
            />
          );
        })}

        {pins.map((p) => {
          const { x, y } = project(Number(p.lat) || 26.8, Number(p.lng) || 30.8);
          const isOrder = p.type === 'order';
          const color = isOrder ? '#7c3aed' : '#2563eb';
          const active = hover?.id === p.id;
          return (
            <g
              key={p.id}
              data-pin
              transform={`translate(${x} ${y})`}
              className="cursor-pointer"
              onMouseEnter={() => setHover(p)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(p)}
              onBlur={() => setHover(null)}
              tabIndex={0}
            >
              {!isOrder && (
                <circle r="14" fill={color} opacity="0.2">
                  <animate
                    attributeName="r"
                    values="8;16;8"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.35;0.05;0.35"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
              <circle
                r={active ? 6.5 : 5}
                fill={color}
                stroke="#fff"
                strokeWidth="1.5"
                filter="url(#live-pin-glow)"
              />
            </g>
          );
        })}

        {hover &&
          (() => {
            const { x, y } = project(Number(hover.lat) || 26.8, Number(hover.lng) || 30.8);
            const label =
              hover.type === 'order'
                ? `Order ${hover.orderId || ''} · ${hover.label}`
                : `${hover.label}${hover.path ? ` · ${hover.path}` : ''}`;
            const tw = Math.min(220, 18 + label.length * 6.2);
            return (
              <g transform={`translate(${x} ${y - 18})`} pointerEvents="none">
                <rect
                  x={-tw / 2}
                  y={-28}
                  width={tw}
                  height={24}
                  rx={6}
                  fill="#18181b"
                  opacity="0.92"
                />
                <text
                  textAnchor="middle"
                  y={-12}
                  fill="#fff"
                  fontSize="11"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  {label.length > 34 ? `${label.slice(0, 32)}…` : label}
                </text>
              </g>
            );
          })()}
      </g>

      <text
        x={16}
        y={MAP.h - 16}
        fill="#64748b"
        fontSize="11"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        Egypt · drag to pan
      </text>
    </svg>
  );
}

export default function StaffLiveView() {
  const [data, setData] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/analytics/live').then((r) => setData(r.data));

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

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-4 xl:flex-row">
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
          <LiveMap pins={pins} zoom={zoom} pan={pan} onPanChange={setPan} />
        </div>

        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-200 bg-white shadow-sm"
            onClick={() => setZoom((z) => Math.min(2.4, Number((z + 0.2).toFixed(2))))}
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-200 bg-white shadow-sm"
            onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.2).toFixed(2))))}
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[10px] font-medium text-zinc-600 shadow-sm"
            onClick={resetView}
          >
            Reset
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
