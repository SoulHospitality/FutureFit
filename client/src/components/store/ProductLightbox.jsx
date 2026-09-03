import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getImageUrl } from '../../utils/helpers';

export default function ProductLightbox({
  open,
  photos,
  index,
  alt,
  onClose,
  onIndexChange,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && photos.length > 1) {
        onIndexChange((index - 1 + photos.length) % photos.length);
      }
      if (e.key === 'ArrowRight' && photos.length > 1) {
        onIndexChange((index + 1) % photos.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, photos.length, index, onClose, onIndexChange]);

  if (!open || !photos?.length) return null;

  const src = photos[index];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-timber-900/95"
      role="dialog"
      aria-modal="true"
      aria-label="Product photos"
    >
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70">
          {index + 1} / {photos.length}
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
        {photos.length > 1 && (
          <>
            <button
              type="button"
              className="absolute start-2 z-10 grid h-11 w-11 place-items-center bg-white text-timber-900 sm:start-6"
              aria-label="Previous photo"
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange((index - 1 + photos.length) % photos.length);
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
                onIndexChange((index + 1) % photos.length);
              }}
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </>
        )}
        {src ? (
          <img
            src={getImageUrl(src, { width: 1600 })}
            alt={alt || ''}
            className="relative z-[1] max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        ) : null}
      </div>

      {photos.length > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 pb-5">
          {photos.map((p, i) => (
            <button
              key={`${p}-${i}`}
              type="button"
              onClick={() => onIndexChange(i)}
              className={`h-14 w-11 shrink-0 overflow-hidden border transition sm:h-16 sm:w-12 ${
                i === index ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={getImageUrl(p, { width: 100 })}
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
