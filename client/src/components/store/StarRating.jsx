import { Star } from 'lucide-react';

export default function StarRating({
  value = 0,
  onChange,
  size = 16,
  readOnly = false,
}) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="inline-flex items-center gap-0.5" role={readOnly ? 'img' : undefined}>
      {stars.map((n) => {
        const filled = n <= Math.round(Number(value) || 0);
        if (readOnly) {
          return (
            <Star
              key={n}
              className={filled ? 'fill-timber-900 text-timber-900' : 'text-timber-300'}
              size={size}
              strokeWidth={1.5}
            />
          );
        }
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(n)}
            className="p-0.5"
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
          >
            <Star
              className={filled ? 'fill-timber-900 text-timber-900' : 'text-timber-300'}
              size={size}
              strokeWidth={1.5}
            />
          </button>
        );
      })}
    </div>
  );
}
