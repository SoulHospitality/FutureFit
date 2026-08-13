export default function StatCard({ title, value, icon: Icon, tone = 'wheat', hint }) {
  const tones = {
    wheat: 'bg-timber-900 text-white',
    muted: 'bg-timber-100 text-timber-700',
    green: 'bg-timber-800 text-white',
    blue: 'bg-timber-100 text-timber-800',
    red: 'bg-timber-200 text-timber-900',
  };

  return (
    <div className="stat-card">
      <div className={`stat-icon ${tones[tone] || tones.wheat}`}>
        {Icon && <Icon className="h-5 w-5" strokeWidth={1.5} />}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-timber-500">
          {title}
        </p>
        <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-timber-900">
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-timber-400">{hint}</p>}
      </div>
    </div>
  );
}
