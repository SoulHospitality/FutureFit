import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { getImageUrl, formatMoney, categoryLabel, totalStock, colorSwatch } from '../../utils/helpers';
import { useWishlist } from '../../context/WishlistContext';
import StarRating from './StarRating';

/** Lookbook-style product tile — image-led, minimal chrome. */
export default function ProductCard({ product }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const { isSaved, toggle } = useWishlist();
  const liked = isSaved(product.id);
  const photos = (product.photos || []).filter(Boolean);
  const price =
    product.isSaleActive && product.salePrice != null ? product.salePrice : product.price;
  const typeLabel = categoryLabel(product);

  const prev = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!photos.length) return;
    setPhotoIndex((i) => (i - 1 + photos.length) % photos.length);
  };

  const next = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!photos.length) return;
    setPhotoIndex((i) => (i + 1) % photos.length);
  };

  return (
    <Link to={`/product/${product.id}`} className="group flex flex-col">
      <div className="relative aspect-[3/4] overflow-hidden bg-timber-100">
        {photos.length ? (
          <img
            src={getImageUrl(photos[photoIndex])}
            alt={product.name}
            className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
            draggable={false}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-sm text-timber-400">
            No photo
          </div>
        )}

        {product.isSaleActive && (
          <span className="absolute start-0 top-0 bg-timber-900 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-white">
            Sale
          </span>
        )}

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute start-0 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center bg-white/90 opacity-0 transition group-hover:opacity-100"
              aria-label="Previous photo"
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute end-0 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center bg-white/90 opacity-0 transition group-hover:opacity-100"
              aria-label="Next photo"
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {photos.slice(0, 5).map((_, i) => (
                <span
                  key={i}
                  className={`h-px transition-all ${
                    i === photoIndex ? 'w-5 bg-white' : 'w-2.5 bg-white/45'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        <button
          type="button"
          aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle(product);
          }}
          className="absolute end-3 top-3 grid h-9 w-9 place-items-center bg-white/95 opacity-0 transition group-hover:opacity-100 hover:bg-white"
        >
          <Heart
            className={`h-4 w-4 ${liked ? 'fill-timber-900 text-timber-900' : 'text-timber-800'}`}
            strokeWidth={1.5}
          />
        </button>
      </div>

      <div className="flex flex-col gap-1 pt-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-timber-400">
          {typeLabel}
        </p>
        <h3 className="text-[15px] font-medium leading-snug text-timber-900 line-clamp-2 group-hover:underline group-hover:underline-offset-4 decoration-timber-300">
          {product.name}
        </h3>
        {product.reviewCount > 0 && (
          <div className="mt-1 flex items-center gap-1.5">
            <StarRating value={product.ratingAvg} readOnly size={12} />
            <span className="text-[11px] text-timber-400">({product.reviewCount})</span>
          </div>
        )}
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-sm tabular-nums text-timber-800">
            {formatMoney(price)}
          </span>
          {product.isSaleActive && product.salePrice != null && (
            <span className="text-xs text-timber-400 line-through">
              {formatMoney(product.price)}
            </span>
          )}
        </div>
        {product.colors?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {product.colors.slice(0, 5).map((c) => (
              <span
                key={c}
                title={c}
                className="h-3 w-3 rounded-full border border-timber-200"
                style={{ backgroundColor: colorSwatch(c) }}
              />
            ))}
          </div>
        )}
        {totalStock(product) < 1 && (
          <p className="text-[11px] uppercase tracking-[0.16em] text-timber-500">Out of stock</p>
        )}
      </div>
    </Link>
  );
}
