import { useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getImageUrl, preloadImages } from '../../utils/helpers';

export default function ProductLightbox({
  open,
  photos,
  index,
  alt,
  onClose,
  onIndexChange,
}) {
  const urls = useMemo(
    () => (photos || []).filter(Boolean).map((src) => getImageUrl(src, { width: 1600 })),
    [photos]
  );
  const safeIndex = urls.length ? Math.min(Math.max(index, 0), urls.length - 1) : 0;

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && urls.length > 1) {
        onIndexChange((safeIndex - 1 + urls.length) % urls.length);
      }
      if (e.key === 'ArrowRight' && urls.length > 1) {
        onIndexChange((safeIndex + 1) % urls.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, urls.length, safeIndex, onClose, onIndexChange]);

  useEffect(() => {
    if (!open || !urls.length) return;
    preloadImages(urls);
  }, [open, urls]);

  if (!open || !urls.length) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-timber-900/95"
      role="dialog"
      aria-modal="true"
      aria-label="Product photos"
    >
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70">
          {safeIndex + 1} / {urls.length}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="grid h-10 w-10 place-items-center text-white hover:bg-white/10"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-12">
        <button
          type="button"
          className="absolute inset-0 cursor-zoom-out"
          aria-label="Close"
          onClick={onClose}
        />
        {urls.length > 1 && (
          <>
            <button
              type="button"
              className="absolute start-2 z-10 grid h-11 w-11 place-items-center bg-white text-timber-900 sm:start-6"
              aria-label="Previous photo"
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange((safeIndex - 1 + urls.length) % urls.length);
              }}
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              className="absolute end-2 z-10 grid h-11 w-11 place-items-center bg-white text-timber-900 sm:end-6"
              aria-label="Next photo"
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange((safeIndex + 1) % urls.length);
              }}
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </>
        )}
        <div className="relative z-[1] flex h-full w-full items-center justify-center">
          {urls.map((src, i) => (
            <img
              key={`${src}-${i}`}
              src={src}
              alt={i === safeIndex ? alt || '' : ''}
              className={`absolute max-h-full max-w-full object-contain transition-opacity duration-150 ${
                i === safeIndex ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              onClick={(e) => e.stopPropagation()}
            />
          ))}
        </div>
      </div>

      {urls.length > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 pb-5">
          {urls.map((src, i) => (
            <button
              key={`thumb-${src}-${i}`}
              type="button"
              onClick={() => onIndexChange(i)}
              className={`h-14 w-11 shrink-0 overflow-hidden border transition sm:h-16 sm:w-12 ${
                i === safeIndex ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={getImageUrl(photos[i], { width: 100 })}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
