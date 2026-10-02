import { memo, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ChevronLeft, ChevronRight, Heart, Plus } from 'lucide-react';
import {
  getImageUrl,
  formatMoney,
  categoryLabel,
  totalStock,
  colorSwatchStyle,
  getSizeStock,
  photosForColor,
  preloadImages,
} from '../../utils/helpers';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import StarRating from './StarRating';
import QuickAddSheet from './QuickAddSheet';

const CARD_GALLERY_LIMIT = 6;

/** Image-led product tile — hover reveals the second shot and a quick-add bar. */
function ProductCard({ product, priority = false }) {
  const [photoIndex, setPhotoIndex] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [previewColor, setPreviewColor] = useState(null);
  const [warm, setWarm] = useState(priority);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { isSaved, toggle } = useWishlist();
  const { addItem, openDrawer } = useCart();
  const liked = isSaved(product.id);

  const photos = useMemo(() => {
    const activeColor = previewColor || product.colors?.[0] || '';
    const list = activeColor ? photosForColor(product, activeColor) : product.photos || [];
    return list.filter(Boolean).slice(0, CARD_GALLERY_LIMIT);
  }, [product, previewColor]);

  const urls = useMemo(() => photos.map((src) => getImageUrl(src, { width: 600 })), [photos]);
  const shownIndex = urls.length
    ? (photoIndex ?? (hovered && urls.length > 1 ? 1 : 0)) % urls.length
    : 0;
  const onSale = product.isSaleActive && product.salePrice != null;
  const price = onSale ? product.salePrice : product.price;
  const discount =
    onSale && Number(product.price) > 0
      ? Math.round((1 - Number(product.salePrice) / Number(product.price)) * 100)
      : 0;
  const typeLabel = categoryLabel(product);
  const stock = totalStock(product);
  const inStock = stock >= 1;
  const lowStock = inStock && stock <= 5;
  const needsOptions =
    (product.sizes && product.sizes.length > 0) ||
    (product.colors && product.colors.length > 1) ||
    !product.sizes;

  useEffect(() => {
    if (!warm || !urls.length) return;
    preloadImages(urls);
  }, [warm, urls]);

  useEffect(() => {
    setPhotoIndex(null);
  }, [previewColor, product.id]);

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
      (product.sizes || []).find((s) => getSizeStock(product, s) > 0) || product.sizes?.[0] || null;
    addItem(product, 1, color, size);
    openDrawer();
  };

  const step = (dir) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!urls.length) return;
    setWarm(true);
    setPhotoIndex((i) => ((i ?? shownIndex) + dir + urls.length) % urls.length);
  };

  return (
    <>
      <Link
        to={`/product/${product.id}`}
        className="product-card group flex flex-col"
        onMouseEnter={() => {
          setWarm(true);
          setHovered(true);
        }}
        onMouseLeave={() => {
          setHovered(false);
          setPhotoIndex(null);
        }}
        onFocus={() => setWarm(true)}
        onTouchStart={() => setWarm(true)}
      >
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-timber-100">
          {urls.length ? (
            urls.map((src, i) => (
              <img
                key={`${src}-${i}`}
                src={src}
                alt={i === shownIndex ? product.name : ''}
                width={600}
                height={800}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px"
                loading={i === 0 || priority || warm ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={priority && i === 0 ? 'high' : 'auto'}
                draggable={false}
                className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-500 ease-ff group-hover:scale-[1.02] ${
                  i === shownIndex ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
              />
            ))
          ) : (
            <div className="grid h-full w-full place-items-center text-sm text-timber-400">No photo</div>
          )}

          <div className="absolute start-3 top-3 z-[1] flex flex-col items-start gap-1.5">
            {!inStock ? (
              <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-timber-500">
                Sold out
              </span>
            ) : onSale ? (
              <span className="rounded-full bg-clay px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                {discount > 0 ? `−${discount}%` : 'Sale'}
              </span>
            ) : null}
            {lowStock && (
              <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-timber-800">
                Only {stock} left
              </span>
            )}
          </div>

          {urls.length > 1 && (
            <>
              <button
                type="button"
                onClick={step(-1)}
                className="absolute start-2 top-1/2 z-[1] hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-timber-800 opacity-0 transition-opacity hover:bg-white group-hover:opacity-100 sm:grid"
                aria-label="Previous photo"
              >
                <ChevronLeft size={15} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={step(1)}
                className="absolute end-2 top-1/2 z-[1] hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-timber-800 opacity-0 transition-opacity hover:bg-white group-hover:opacity-100 sm:grid"
                aria-label="Next photo"
              >
                <ChevronRight size={15} strokeWidth={1.75} />
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
            className="absolute end-3 top-3 z-[1] grid h-9 w-9 place-items-center rounded-full bg-white/95 text-timber-800 shadow-sm transition hover:scale-105 hover:bg-white"
          >
            <Heart
              className={`h-4 w-4 ${liked ? 'fill-clay text-clay' : ''}`}
              strokeWidth={1.5}
            />
          </button>

          {/* Desktop quick add */}
          <button
            type="button"
            disabled={!inStock}
            onClick={quickAdd}
            className="absolute inset-x-3 bottom-3 z-[1] hidden translate-y-3 items-center justify-center gap-2 rounded-full bg-white/95 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-timber-900 opacity-0 shadow-[0_10px_30px_-12px_rgba(28,24,21,0.4)] backdrop-blur transition duration-300 ease-ff hover:bg-timber-900 hover:text-white group-hover:translate-y-0 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-0 lg:flex"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            {needsOptions ? 'Quick add' : 'Add to bag'}
          </button>
          {/* Touch quick add */}
          <button
            type="button"
            aria-label={inStock ? 'Add to bag' : 'Out of stock'}
            disabled={!inStock}
            onClick={quickAdd}
            className="absolute bottom-3 end-3 z-[1] grid h-10 w-10 place-items-center rounded-full bg-white/95 text-timber-900 shadow-[0_8px_20px_-10px_rgba(28,24,21,0.5)] transition active:scale-95 disabled:hidden lg:hidden"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-1 px-0.5 pt-3.5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[14px] font-semibold leading-snug text-timber-900 line-clamp-2 sm:text-[15px]">
              {product.name}
            </h3>
          </div>
          {typeLabel ? <p className="text-[12px] text-timber-400">{typeLabel}</p> : null}
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
            <span className={`text-sm font-semibold tabular-nums ${onSale ? 'text-clay' : 'text-timber-800'}`}>
              {formatMoney(price)}
            </span>
            {onSale && (
              <span className="text-xs tabular-nums text-timber-400 line-through">
                {formatMoney(product.price)}
              </span>
            )}
          </div>
          {product.reviewCount > 0 && (
            <div className="mt-0.5 flex items-center gap-1.5">
              <StarRating value={product.ratingAvg} readOnly size={12} />
              <span className="text-[11px] text-timber-400">({product.reviewCount})</span>
            </div>
          )}
          {product.colors?.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {product.colors.slice(0, 5).map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  aria-label={`Preview ${c}`}
                  className={`h-4 w-4 rounded-full border transition ${
                    previewColor === c ? 'border-timber-900 ring-1 ring-timber-900 ring-offset-1' : 'border-timber-200'
                  }`}
                  style={colorSwatchStyle(c)}
                  onMouseEnter={() => {
                    setWarm(true);
                    setPreviewColor(c);
                  }}
                  onMouseLeave={() => setPreviewColor(null)}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setWarm(true);
                    setPreviewColor(c);
                  }}
                />
              ))}
              {product.colors.length > 5 && (
                <span className="text-[11px] text-timber-400">+{product.colors.length - 5}</span>
              )}
            </div>
          )}
        </div>
      </Link>
      <QuickAddSheet product={product} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

export default memo(ProductCard);
