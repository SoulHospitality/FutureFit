/** Date ranges for staff reporting (Dashboard, Analytics), in the viewer's local time. */

export const RANGE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'custom', label: 'Custom' },
];

/** Local calendar date as "YYYY-MM-DD" (toISOString would shift it to UTC). */
export function localIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function rangeForPreset(id, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (id) {
    case 'yesterday': {
      const day = localIsoDate(new Date(y, m, d - 1));
      return { from: day, to: day };
    }
    case 'this_month':
      return { from: localIsoDate(new Date(y, m, 1)), to: localIsoDate(now) };
    case 'last_month':
      return {
        from: localIsoDate(new Date(y, m - 1, 1)),
        to: localIsoDate(new Date(y, m, 0)),
      };
    case 'today':
    default: {
      const day = localIsoDate(now);
      return { from: day, to: day };
    }
  }
}

/** Resolve the picker state to { from, to } with from ≤ to. */
export function resolveRange(preset, custom) {
  if (preset !== 'custom') return rangeForPreset(preset);
  let { from, to } = custom || {};
  const today = localIsoDate(new Date());
  from = from || to || today;
  to = to || from;
  return from <= to ? { from, to } : { from: to, to: from };
}

/** Query params the server needs to cut days in the viewer's time zone. */
export function rangeParams(range) {
  return { from: range.from, to: range.to, tz: new Date().getTimezoneOffset() };
}

/** Short human label for the chosen range, e.g. "1 Nov – 8 Nov 2026". */
export function rangeLabel(range) {
  const fmt = (s, withYear) =>
    new Date(`${s}T00:00:00`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
    });
  if (range.from === range.to) return fmt(range.from, true);
  return `${fmt(range.from, range.from.slice(0, 4) !== range.to.slice(0, 4))} – ${fmt(range.to, true)}`;
}
