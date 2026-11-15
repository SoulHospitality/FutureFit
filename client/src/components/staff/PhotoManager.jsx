import { useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff, Star, X } from 'lucide-react';
import { getImageUrl } from '../../utils/helpers';

/**
 * Thumbnail grid for a product's photos: shows every photo in order with the
 * cover marked, flags photos that fail to load, and lets staff reorder,
 * set the cover, or remove photos. `photos` is an array; `onChange` gets the new array.
 */
export default function PhotoManager({ photos, onChange }) {
  const [broken, setBroken] = useState(() => new Set());

  if (!photos.length) return null;

  const move = (from, to) => {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  const remove = (i) => onChange(photos.filter((_, idx) => idx !== i));
  const markBroken = (url) =>
    setBroken((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));
  const markLoaded = (url) =>
    setBroken((prev) => {
      if (!prev.has(url)) return prev;
      const next = new Set(prev);
      next.delete(url);
      return next;
    });

  const brokenCount = photos.filter((u) => broken.has(u)).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-timber-500">
          {photos.length} photo{photos.length === 1 ? '' : 's'} · the first one is the cover
        </span>
        <div className="flex items-center gap-3">
          {brokenCount > 0 && (
            <button
              type="button"
              className="font-medium text-red-600 hover:underline"
              onClick={() => onChange(photos.filter((u) => !broken.has(u)))}
            >
              Remove {brokenCount} that can&apos;t load
            </button>
          )}
          <button
            type="button"
            className="font-medium text-timber-500 hover:text-red-600 hover:underline"
            onClick={() => {
              if (window.confirm('Remove all photos from this item?')) onChange([]);
            }}
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {photos.map((url, i) => {
          const isBroken = broken.has(url);
          return (
            <div
              key={`${url}-${i}`}
              className={`group relative aspect-[3/4] overflow-hidden rounded-lg border bg-timber-50 ${
                isBroken ? 'border-red-300' : i === 0 ? 'border-timber-900' : 'border-timber-100'
              }`}
            >
              {isBroken ? (
                <div className="grid h-full w-full place-items-center p-1 text-center text-[10px] leading-tight text-red-600">
                  <div>
                    <ImageOff className="mx-auto mb-1 h-4 w-4" />
                    Can&apos;t load — check Drive sharing
                  </div>
                </div>
              ) : (
                <img
                  src={getImageUrl(url, { width: 240 })}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                  onError={() => markBroken(url)}
                  onLoad={() => markLoaded(url)}
                />
              )}
              <span
                className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  i === 0 ? 'bg-timber-900 text-white' : 'bg-white/90 text-timber-700'
                }`}
              >
                {i === 0 ? 'Cover' : i + 1}
              </span>
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => remove(i)}
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-white/95 text-timber-700 shadow-sm hover:bg-red-600 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                <button
                  type="button"
                  aria-label="Move earlier"
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className="grid h-6 w-6 place-items-center rounded bg-white/95 text-timber-800 shadow-sm disabled:opacity-30"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {i > 0 && (
                  <button
                    type="button"
                    aria-label="Make cover photo"
                    title="Make cover"
                    onClick={() => move(i, 0)}
                    className="grid h-6 w-6 place-items-center rounded bg-white/95 text-timber-800 shadow-sm"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Move later"
                  disabled={i === photos.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="grid h-6 w-6 place-items-center rounded bg-white/95 text-timber-800 shadow-sm disabled:opacity-30"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
