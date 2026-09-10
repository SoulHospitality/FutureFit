/** Dual-series line chart (current vs compare) without chart libs. */
export default function DualLineChart({
  current = [],
  previous = [],
  height = 220,
  className = '',
}) {
  const w = 640;
  const h = height;
  const pad = { t: 16, r: 12, b: 28, l: 44 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const vals = [...current, ...previous].map((p) => Number(p.value) || 0);
  const max = Math.max(...vals, 1);
  const n = Math.max(current.length, previous.length, 2);

  const point = (series, i) => {
    const x = pad.l + (i / Math.max(n - 1, 1)) * innerW;
    const v = Number(series[i]?.value) || 0;
    const y = pad.t + innerH - (v / max) * innerH;
    return `${x},${y}`;
  };

  const poly = (series) =>
    series.length
      ? series.map((_, i) => point(series, i)).join(' ')
      : '';

  const yTicks = [0, 0.5, 1].map((t) => ({
    y: pad.t + innerH - t * innerH,
    label: Math.round(max * t),
  }));

  const xLabels = [];
  const step = Math.max(1, Math.floor(current.length / 6));
  for (let i = 0; i < current.length; i += step) {
    const raw = current[i]?.label || '';
    const short = raw.includes('T') ? raw.slice(11, 16) : raw.slice(5);
    xLabels.push({
      x: pad.l + (i / Math.max(n - 1, 1)) * innerW,
      label: short,
    });
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`w-full ${className}`} role="img">
      {yTicks.map((t) => (
        <g key={t.y}>
          <line
            x1={pad.l}
            x2={w - pad.r}
            y1={t.y}
            y2={t.y}
            stroke="#e4e4e7"
            strokeWidth="1"
          />
          <text x={pad.l - 8} y={t.y + 4} textAnchor="end" className="fill-zinc-400" fontSize="10">
            {t.label}
          </text>
        </g>
      ))}
      {previous.length > 1 && (
        <polyline
          fill="none"
          stroke="#93c5fd"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={poly(previous)}
        />
      )}
      {current.length > 1 && (
        <polyline
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.25"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={poly(current)}
        />
      )}
      {xLabels.map((l) => (
        <text
          key={`${l.x}-${l.label}`}
          x={l.x}
          y={h - 8}
          textAnchor="middle"
          className="fill-zinc-400"
          fontSize="10"
        >
          {l.label}
        </text>
      ))}
    </svg>
  );
}
