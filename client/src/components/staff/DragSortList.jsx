import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, GripVertical, X } from 'lucide-react';

/**
 * Drag-and-drop reorder list (HTML5) with multi-select.
 * Tick several rows (Shift-click for a range, Ctrl/⌘-click a row to toggle), then drag
 * any of them or use the toolbar to move the whole group. Calls onReorder(nextItems).
 */
export default function DragSortList({
  items,
  onReorder,
  getKey = (item) => item.id,
  renderItem,
  disabled = false,
  selectable = true,
  itemLabel = 'item',
  className = '',
}) {
  const [selected, setSelected] = useState(() => new Set());
  const [dragIds, setDragIds] = useState(null);
  const [over, setOver] = useState(null);
  const [position, setPosition] = useState('');
  const dragIdsRef = useRef(null);
  const anchorRef = useRef(null);
  const fieldPressRef = useRef(false);

  const keys = useMemo(() => items.map((item) => getKey(item)), [items, getKey]);
  const selectedKeys = useMemo(() => keys.filter((k) => selected.has(k)), [keys, selected]);
  const selectedCount = selectedKeys.length;
  const allSelected = keys.length > 0 && selectedCount === keys.length;
  const plural = (n) => `${n} ${itemLabel}${n === 1 ? '' : 's'}`;

  const commit = (nextKeys) => {
    const byKey = new Map(items.map((item) => [getKey(item), item]));
    const next = nextKeys.map((k) => byKey.get(k));
    if (next.every((item, i) => item === items[i])) return;
    onReorder(next);
  };

  const placeGroup = (group, insertAt) => {
    const groupSet = new Set(group);
    const rest = keys.filter((k) => !groupSet.has(k));
    const at = Math.max(0, Math.min(insertAt, rest.length));
    commit([...rest.slice(0, at), ...group, ...rest.slice(at)]);
  };

  const dropOn = (targetKey, side) => {
    const group = dragIdsRef.current;
    if (!group?.length || group.includes(targetKey)) return;
    const groupSet = new Set(group);
    const rest = keys.filter((k) => !groupSet.has(k));
    const targetIdx = rest.indexOf(targetKey);
    if (targetIdx < 0) return;
    placeGroup(group, side === 'after' ? targetIdx + 1 : targetIdx);
  };

  const nudge = (dir) => {
    const next = [...keys];
    const order = dir < 0 ? next.map((_, i) => i) : next.map((_, i) => next.length - 1 - i);
    for (const i of order) {
      const j = i + dir;
      if (!selected.has(next[i]) || j < 0 || j >= next.length || selected.has(next[j])) continue;
      [next[i], next[j]] = [next[j], next[i]];
    }
    commit(next);
  };

  const moveToPosition = (e) => {
    e?.preventDefault();
    if (disabled) return;
    const n = Number(position);
    if (!Number.isFinite(n) || n < 1) return;
    placeGroup(selectedKeys, Math.round(n) - 1);
    setPosition('');
  };

  const toggle = (key, { range = false } = {}) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (range && anchorRef.current != null && keys.includes(anchorRef.current)) {
        const a = keys.indexOf(anchorRef.current);
        const b = keys.indexOf(key);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        for (let i = lo; i <= hi; i++) next.add(keys[i]);
      } else if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    anchorRef.current = key;
  };

  const clearSelection = () => {
    setSelected(new Set());
    anchorRef.current = null;
  };

  const resetDrag = () => {
    dragIdsRef.current = null;
    setDragIds(null);
    setOver(null);
  };

  const showToolbar = selectable && keys.length > 1;
  const btn =
    'inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-900 disabled:opacity-40';

  return (
    <div>
      {showToolbar && (
        <div
          className={`sticky top-14 z-20 flex flex-wrap items-center gap-2 border-b px-4 py-2.5 backdrop-blur ${
            selectedCount ? 'border-zinc-900/10 bg-zinc-900/[0.04]' : 'border-zinc-100 bg-white/95'
          }`}
        >
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-600">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer accent-zinc-900"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = selectedCount > 0 && !allSelected;
              }}
              onChange={() => (allSelected ? clearSelection() : setSelected(new Set(keys)))}
            />
            {selectedCount ? `${plural(selectedCount)} selected` : 'Select'}
          </label>

          {selectedCount > 0 ? (
            <>
              <span className="mx-1 hidden h-5 w-px bg-zinc-200 sm:block" />
              <button
                type="button"
                className={btn}
                disabled={disabled}
                onClick={() => placeGroup(selectedKeys, 0)}
                title="Move to top"
              >
                <ArrowUpToLine className="h-3.5 w-3.5" /> Top
              </button>
              <button type="button" className={btn} disabled={disabled} onClick={() => nudge(-1)} title="Move up one">
                <ArrowUp className="h-3.5 w-3.5" /> Up
              </button>
              <button type="button" className={btn} disabled={disabled} onClick={() => nudge(1)} title="Move down one">
                <ArrowDown className="h-3.5 w-3.5" /> Down
              </button>
              <button
                type="button"
                className={btn}
                disabled={disabled}
                onClick={() => placeGroup(selectedKeys, keys.length)}
                title="Move to bottom"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" /> Bottom
              </button>
              <form onSubmit={moveToPosition} className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={keys.length}
                  inputMode="numeric"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Pos."
                  aria-label="Move selection to position"
                  className="h-8 w-16 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-zinc-500"
                />
                <button type="submit" className={btn} disabled={disabled || !position}>
                  Move
                </button>
              </form>
              <button
                type="button"
                className="ms-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                onClick={clearSelection}
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            </>
          ) : (
            <span className="text-xs text-zinc-400">
              Tick rows to move several at once · Shift-click selects a range
            </span>
          )}
        </div>
      )}

      <ul className={className}>
        {items.map((item, index) => {
          const id = getKey(item);
          const isSelected = selected.has(id);
          const isDragging = dragIds?.includes(id);
          const isOver = over?.id === id && dragIds && !dragIds.includes(id);
          return (
            <li
              key={id}
              draggable={!disabled}
              onClick={(e) => {
                if (!showToolbar) return;
                if (e.target.closest('button, a, input, select, textarea, label')) return;
                if (e.shiftKey) toggle(id, { range: true });
                else if (e.metaKey || e.ctrlKey) toggle(id);
              }}
              onPointerDown={(e) => {
                fieldPressRef.current = Boolean(e.target.closest?.('input, textarea, select'));
              }}
              onDragStart={(e) => {
                if (disabled) return;
                if (fieldPressRef.current) {
                  // Selecting text inside an input shouldn't pick up the whole row
                  e.preventDefault();
                  return;
                }
                const group = isSelected && selectedCount > 1 ? selectedKeys : [id];
                dragIdsRef.current = group;
                setDragIds(group);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', id);
                if (group.length > 1) {
                  const ghost = document.createElement('div');
                  ghost.textContent = `Moving ${plural(group.length)}`;
                  Object.assign(ghost.style, {
                    position: 'fixed',
                    top: '-1000px',
                    left: '0',
                    padding: '8px 14px',
                    background: '#18181b',
                    color: '#fff',
                    borderRadius: '999px',
                    font: '600 13px system-ui, sans-serif',
                    whiteSpace: 'nowrap',
                  });
                  document.body.appendChild(ghost);
                  e.dataTransfer.setDragImage(ghost, 16, 16);
                  setTimeout(() => ghost.remove(), 0);
                } else if (e.currentTarget instanceof HTMLElement) {
                  e.dataTransfer.setDragImage(e.currentTarget, 24, 24);
                }
              }}
              onDragEnd={resetDrag}
              onDragOver={(e) => {
                if (disabled || !dragIdsRef.current) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const rect = e.currentTarget.getBoundingClientRect();
                const side = e.clientY - rect.top > rect.height / 2 ? 'after' : 'before';
                if (over?.id !== id || over?.side !== side) setOver({ id, side });
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget) && over?.id === id) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (over?.id === id) dropOn(id, over.side);
                resetDrag();
              }}
              className={`flex select-none items-center gap-3 border-b border-zinc-100 py-3 transition-colors last:border-0 ${
                isSelected ? 'bg-zinc-900/[0.04]' : 'bg-white'
              } ${isDragging ? 'opacity-40' : ''} ${
                isOver
                  ? over.side === 'before'
                    ? 'shadow-[inset_0_2px_0_0_#18181b]'
                    : 'shadow-[inset_0_-2px_0_0_#18181b]'
                  : ''
              } ${disabled ? '' : 'cursor-grab active:cursor-grabbing'}`}
            >
              {showToolbar ? (
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 cursor-pointer accent-zinc-900"
                  checked={isSelected}
                  aria-label={`Select ${itemLabel} ${index + 1}`}
                  onChange={(e) => toggle(id, { range: e.nativeEvent.shiftKey })}
                />
              ) : null}
              <span className="flex shrink-0 items-center text-zinc-300" aria-hidden title="Drag to reorder">
                <GripVertical className="h-4 w-4" strokeWidth={1.5} />
              </span>
              <span className="w-6 shrink-0 text-center text-xs tabular-nums text-zinc-400">{index + 1}</span>
              <div className="min-w-0 flex-1">{renderItem(item, index)}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
