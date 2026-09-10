import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ChevronLeft, ChevronRight, Heart, ShoppingBag } from 'lucide-react';
import { getImageUrl, formatMoney, categoryLabel, totalStock, colorSwatchStyle, getSizeStock, photosForColor } from '../../utils/helpers';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import StarRating from './StarRating';
import QuickAddSheet from './QuickAddSheet';

/** Lookbook-style product tile — image-led, minimal chrome. */
function ProductCard({ product, priority = false }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [previewColor, setPreviewColor] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { isSaved, toggle } = useWishlist();
  const { addItem, openDrawer } = useCart();
  const liked = isSaved(product.id);
  const photos = (
    previewColor ? photosForColor(product, previewColor) : product.photos || []
  ).filter(Boolean);
  const safeIndex = photos.length ? photoIndex % photos.length : 0;
  const price =
    product.isSaleActive && product.salePrice != null ? product.salePrice : product.price;
  const typeLabel = categoryLabel(product);
  const inStock = totalStock(product) >= 1;
  const needsOptions =
    (product.sizes && product.sizes.length > 0) ||
    (product.colors && product.colors.length > 1) ||
    !product.sizes;

  const quickAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!inStock) return toast.error('Out of stock');
    if (needsOptions) {
      setSheetOpen(true);
      return;
    }
    const color = product.colors?.[0] || null;
    const size =
      (product.sizes || []).find((s) => getSizeStock(product, s) > 0) ||
      product.sizes?.[0] ||
      null;
    addItem(product, 1, color, size);
    openDrawer();
  };

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
    <>
      <Link to={`/product/${product.id}`} className="product-card group flex flex-col">
        <div className="relative aspect-[3/4] overflow-hidden bg-timber-100">
          {photos.length ? (
            <img
              src={getImageUrl(photos[safeIndex], { width: 600 })}
              alt={product.name}
              width={600}
              height={800}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 280px"
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={priority ? 'high' : 'auto'}
              className="h-full w-full object-cover"
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
                className="absolute start-0 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center bg-white/90 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Previous photo"
              >
                <ChevronLeft size={16} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute end-0 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center bg-white/90 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Next photo"
              >
                <ChevronRight size={16} strokeWidth={1.5} />
              </button>
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
            className="absolute end-3 top-3 grid h-9 w-9 place-items-center bg-white/95 opacity-100 transition-opacity sm:opacity-0 group-hover:opacity-100 hover:bg-white"
          >
            <Heart
              className={`h-4 w-4 ${liked ? 'fill-timber-900 text-timber-900' : 'text-timber-800'}`}
              strokeWidth={1.5}
            />
          </button>
          <button
            type="button"
            aria-label={inStock ? 'Add to cart' : 'Out of stock'}
            disabled={!inStock}
            onClick={quickAdd}
            className="absolute end-3 bottom-3 grid h-10 w-10 place-items-center bg-timber-900 text-white transition hover:bg-timber-800 disabled:cursor-not-allowed disabled:bg-timber-300"
          >
            <ShoppingBag className="h-4 w-4" strokeWidth={1.5} />
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
                <button
                  key={c}
                  type="button"
                  title={c}
                  aria-label={`Preview ${c}`}
                  className="h-3 w-3 rounded-full border border-timber-200"
                  style={colorSwatchStyle(c)}
                  onMouseEnter={() => {
                    setPreviewColor(c);
                    setPhotoIndex(0);
                  }}
                  onMouseLeave={() => {
                    setPreviewColor(null);
                    setPhotoIndex(0);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPreviewColor(c);
                    setPhotoIndex(0);
                  }}
                />
              ))}
            </div>
          )}
          {totalStock(product) < 1 && (
            <p className="text-[11px] uppercase tracking-[0.16em] text-timber-500">Out of stock</p>
          )}
        </div>
      </Link>
      <QuickAddSheet product={product} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

export default memo(ProductCard);
