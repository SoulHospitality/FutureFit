/** Tiny SVG sparkline for staff metric strips. */
export default function Sparkline({ values = [], className = '', stroke = '#16a34a' }) {
  const nums = values.map((v) => Number(v) || 0);
  const w = 72;
  const h = 28;
  const max = Math.max(...nums, 1);
  const min = Math.min(...nums, 0);
  const span = Math.max(max - min, 1);
  if (nums.length < 2) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
        <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke={stroke} strokeWidth="1.5" opacity="0.35" />
      </svg>
    );
  }
  const pts = nums
    .map((v, i) => {
      const x = (i / (nums.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  const up = nums[nums.length - 1] >= nums[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
      <polyline
        fill="none"
        stroke={up ? stroke : '#a1a1aa'}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
    </svg>
  );
}
