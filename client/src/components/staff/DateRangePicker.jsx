import { RANGE_PRESETS, rangeLabel } from '../../utils/dateRange';

/**
 * Today / Yesterday / This month / Last month / Custom.
 * `custom` is { from, to } ("YYYY-MM-DD"); `range` is the resolved range shown as a label.
 */
export default function DateRangePicker({ preset, onPreset, custom, onCustom, range }) {
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPreset(p.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              preset === p.id
                ? 'bg-zinc-900 text-white'
                : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-zinc-500">
            From
            <input
              type="date"
              className="ml-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
              value={custom.from}
              max={custom.to || undefined}
              onChange={(e) => onCustom({ ...custom, from: e.target.value })}
            />
          </label>
          <label className="text-xs text-zinc-500">
            To
            <input
              type="date"
              className="ml-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
              value={custom.to}
              min={custom.from || undefined}
              onChange={(e) => onCustom({ ...custom, to: e.target.value })}
            />
          </label>
        </div>
      ) : (
        range && <p className="text-xs text-zinc-400">{rangeLabel(range)}</p>
      )}
    </div>
  );
}
