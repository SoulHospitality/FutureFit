import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import {
  formatMoney,
  getImageUrl,
  calcShipping,
  FREE_SHIPPING_MIN,
} from '../../utils/helpers';

export default function MiniCartDrawer() {
  const {
    items,
    updateQty,
    removeItem,
    subtotal,
    drawerOpen,
    closeDrawer,
  } = useCart();
  const shipping = calcShipping(subtotal);
  const remaining = Math.max(0, FREE_SHIPPING_MIN - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_MIN) * 100);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen, closeDrawer]);

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Shopping bag">
      <button
        type="button"
        className="absolute inset-0 bg-timber-900/40"
        aria-label="Close bag"
        onClick={closeDrawer}
      />
      <aside className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col border-s border-timber-200 bg-white shadow-[-16px_0_48px_-24px_rgba(9,9,11,0.35)]">
        <div className="flex items-center justify-between border-b border-timber-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-timber-700">
              Your bag
            </p>
            <p className="mt-1 text-sm text-timber-500">
              {items.length === 0
                ? 'Empty'
                : `${items.reduce((s, i) => s + i.qty, 0)} item${items.reduce((s, i) => s + i.qty, 0) === 1 ? '' : 's'}`}
            </p>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            className="grid h-10 w-10 place-items-center text-timber-600 hover:bg-timber-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-timber-500">Your bag is empty.</p>
              <Link
                to="/shop"
                onClick={closeDrawer}
                className="mt-4 inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-timber-800 underline underline-offset-4"
              >
                Browse collection
              </Link>
            </div>
          ) : (
            <ul className="space-y-0 divide-y divide-timber-100">
              {items.map((item) => (
                <li
                  key={`${item.productId}-${item.color}-${item.size}`}
                  className="flex gap-3 py-4 first:pt-0"
                >
                  <Link
                    to={`/product/${item.productId}`}
                    onClick={closeDrawer}
                    className="shrink-0"
                  >
                    <img
                      src={getImageUrl(item.image, { width: 160 })}
                      alt=""
                      className="h-24 w-20 object-cover bg-timber-100"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={`/product/${item.productId}`}
                          onClick={closeDrawer}
                          className="block truncate text-sm font-medium text-timber-900 hover:underline"
                        >
                          {item.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-timber-500">
                          {[item.color, item.size && `Size ${item.size}`]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </p>
                        <p className="mt-1 text-sm tabular-nums text-timber-800">
                          {formatMoney(item.price)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="grid h-8 w-8 shrink-0 place-items-center text-timber-400 hover:text-timber-900"
                        onClick={() => removeItem(item.productId, item.color, item.size)}
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>
                    <div className="mt-3 inline-flex items-center border border-timber-200">
                      <button
                        type="button"
                        className="px-2 py-1.5 text-timber-700 hover:bg-timber-50"
                        onClick={() =>
                          updateQty(item.productId, item.color, item.size, item.qty - 1)
                        }
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <span className="min-w-[1.75rem] text-center text-xs tabular-nums">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        className="px-2 py-1.5 text-timber-700 hover:bg-timber-50"
                        disabled={item.stock > 0 && item.qty >= item.stock}
                        onClick={() =>
                          updateQty(item.productId, item.color, item.size, item.qty + 1)
                        }
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-timber-100 px-5 py-5">
            <div className="mb-4">
              {remaining > 0 ? (
                <p className="text-xs text-timber-500">
                  Add {formatMoney(remaining)} more for free shipping
                </p>
              ) : (
                <p className="text-xs text-timber-700">You’ve unlocked free shipping</p>
              )}
              <div className="mt-2 h-1 w-full bg-timber-100">
                <div
                  className="h-full bg-timber-900 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-timber-500">Subtotal</span>
              <span className="tabular-nums text-timber-900">{formatMoney(subtotal)}</span>
            </div>
            <div className="mb-4 flex justify-between text-sm">
              <span className="text-timber-500">Shipping</span>
              <span className="tabular-nums text-timber-900">
                {shipping === 0 ? 'Free' : formatMoney(shipping)}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                to="/checkout"
                onClick={closeDrawer}
                className="btn-wheat w-full min-h-12 text-center"
              >
                Checkout
              </Link>
              <Link
                to="/cart"
                onClick={closeDrawer}
                className="btn-outline w-full min-h-11 text-center text-[10px] uppercase tracking-[0.18em]"
              >
                View bag
              </Link>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
