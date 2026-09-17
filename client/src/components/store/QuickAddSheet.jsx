import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useCart } from '../../context/CartContext';
import BrandLoader from '../ui/BrandLoader';
import {
  colorSwatchStyle,
  formatMoney,
  getImageUrl,
  getSizeStock,
  photosForColor,
  totalStock,
} from '../../utils/helpers';

export default function QuickAddSheet({ product: seed, open, onClose }) {
  const { addItem, openDrawer } = useCart();
  const [product, setProduct] = useState(seed);
  const [loading, setLoading] = useState(false);
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open || !seed?.id) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    let cancelled = false;
    setLoading(true);
    api
      .get(`/products/${seed.id}`)
      .then((r) => {
        if (cancelled) return;
        const p = r.data;
        setProduct(p);
        setColor(p.colors?.[0] || '');
        const first =
          (p.sizes || []).find((s) => getSizeStock(p, s) > 0) || p.sizes?.[0] || '';
        setSize(first);
      })
      .catch(() => {
        if (cancelled) return;
        setProduct(seed);
        setColor(seed.colors?.[0] || '');
        setSize(seed.sizes?.[0] || '');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      document.body.style.overflow = prev;
    };
  }, [open, seed?.id]);

  if (!open || !seed) return null;

  const price =
    product?.isSaleActive && product?.salePrice != null ? product.salePrice : product?.price;
  const available = product?.sizes?.length
    ? getSizeStock(product, size)
    : totalStock(product);
  const canAdd = available >= 1 && (!product?.sizes?.length || size) && (!product?.colors?.length || color);
  const gallery = photosForColor(product || seed, color);
  const photo = gallery[0] || product?.photos?.[0] || seed.photos?.[0] || seed.image || '';

  const confirm = () => {
    if (!product) return;
    if (product.colors?.length && !color) {
      toast.error('Select a colour');
      return;
    }
    if (product.sizes?.length && !size) {
      toast.error('Select a size');
      return;
    }
    if (available < 1) {
      toast.error(size ? `Size ${size} is out of stock` : 'Out of stock');
      return;
    }
    setAdding(true);
    addItem(product, 1, color || null, size || null);
    setAdding(false);
    onClose?.();
    openDrawer();
  };

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Choose options">
      <button
        type="button"
        className="absolute inset-0 bg-timber-900/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto border-t border-timber-200 bg-white shadow-[0_-16px_48px_-24px_rgba(9,9,11,0.35)] sm:inset-x-auto sm:bottom-8 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:border sm:shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-timber-100 bg-white px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-timber-700">
            Select options
          </p>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center text-timber-600 hover:bg-timber-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="flex gap-4">
            <div className="h-24 w-20 shrink-0 overflow-hidden bg-timber-100">
              {photo ? (
                <img
                  src={getImageUrl(photo, { width: 200 })}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-xl font-medium tracking-tight text-timber-900 line-clamp-2">
                {product?.name || seed.name}
              </h3>
              <p className="mt-1 text-sm tabular-nums text-timber-700">{formatMoney(price)}</p>
            </div>
          </div>

          {loading ? (
            <div className="mt-10 grid place-items-center py-8">
              <BrandLoader size="sm" label="Loading" />
            </div>
          ) : (
            <>
              {product?.colors?.length > 0 && (
                <div className="mt-8">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-timber-700">
                      Colour
                    </span>
                    <span className="text-sm text-timber-500">{color}</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {product.colors.map((c) => {
                      const selected = color === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          title={c}
                          onClick={() => setColor(c)}
                          className={`relative grid h-10 w-10 place-items-center rounded-full border transition ${
                            selected
                              ? 'border-timber-900 ring-2 ring-timber-900 ring-offset-2'
                              : 'border-timber-200 hover:border-timber-500'
                          }`}
                        >
                          <span
                            className="h-7 w-7 rounded-full border border-black/10"
                            style={colorSwatchStyle(c)}
                          />
                          <span className="sr-only">{c}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {product?.sizes?.length > 0 && (
                <div className="mt-8">
                  <span className="mb-3 block text-[10px] font-medium uppercase tracking-[0.24em] text-timber-700">
                    Size
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((s) => {
                      const sizeQty = getSizeStock(product, s);
                      const soldOut = sizeQty < 1;
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={soldOut}
                          onClick={() => setSize(s)}
                          className={`min-w-[3rem] border px-3 py-2.5 text-sm font-medium transition ${
                            soldOut
                              ? 'cursor-not-allowed border-timber-100 text-timber-300 line-through'
                              : size === s
                                ? 'border-timber-900 bg-timber-900 text-white'
                                : 'border-timber-200 bg-white text-timber-800 hover:border-timber-900'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <button
            type="button"
            className="btn-wheat mt-8 w-full min-h-12"
            disabled={loading || adding || !canAdd}
            onClick={confirm}
          >
            {!loading && totalStock(product) < 1
              ? 'Out of stock'
              : adding
                ? 'Adding…'
                : 'Add to bag'}
          </button>
          <Link
            to={`/product/${seed.id}`}
            onClick={onClose}
            className="mt-3 block text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-timber-500 underline-offset-4 hover:text-timber-900 hover:underline"
          >
            View full details
          </Link>
        </div>
      </div>
    </div>
  );
}
