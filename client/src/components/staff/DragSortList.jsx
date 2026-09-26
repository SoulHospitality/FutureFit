import { useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

/**
 * Drag-and-drop reorder list (HTML5). Calls onReorder(nextItems) after a drop.
 */
export default function DragSortList({
  items,
  onReorder,
  getKey = (item) => item.id,
  renderItem,
  disabled = false,
  className = '',
}) {
  const [draggingId, setDraggingId] = useState(null);
  const [overId, setOverId] = useState(null);
  const dragIdRef = useRef(null);

  const moveItem = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    const from = items.findIndex((item) => getKey(item) === fromId);
    const to = items.findIndex((item) => getKey(item) === toId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  return (
    <ul className={className}>
      {items.map((item, index) => {
        const id = getKey(item);
        const isDragging = draggingId === id;
        const isOver = overId === id && draggingId && draggingId !== id;
        return (
          <li
            key={id}
            draggable={!disabled}
            onDragStart={(e) => {
              if (disabled) return;
              dragIdRef.current = id;
              setDraggingId(id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', id);
              // Improve Chrome drag image
              if (e.currentTarget instanceof HTMLElement) {
                e.dataTransfer.setDragImage(e.currentTarget, 24, 24);
              }
            }}
            onDragEnd={() => {
              dragIdRef.current = null;
              setDraggingId(null);
              setOverId(null);
            }}
            onDragOver={(e) => {
              if (disabled) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (overId !== id) setOverId(id);
            }}
            onDragLeave={() => {
              if (overId === id) setOverId(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const fromId = dragIdRef.current || e.dataTransfer.getData('text/plain');
              moveItem(fromId, id);
              setDraggingId(null);
              setOverId(null);
              dragIdRef.current = null;
            }}
            className={`flex items-center gap-3 border-b border-zinc-100 bg-white py-3 last:border-0 ${
              isDragging ? 'opacity-40' : ''
            } ${isOver ? 'border-t-2 border-t-zinc-900' : ''} ${
              disabled ? '' : 'cursor-grab active:cursor-grabbing'
            }`}
          >
            <span
              className="flex shrink-0 items-center text-zinc-300"
              aria-hidden
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" strokeWidth={1.5} />
            </span>
            <span className="w-6 shrink-0 text-center text-xs tabular-nums text-zinc-400">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">{renderItem(item, index)}</div>
          </li>
        );
      })}
    </ul>
  );
}
