import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Banknote, CreditCard, Minus, Plus, ShoppingBag, Trash2, Truck, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { formatMoney, getImageUrl, calcShipping, FREE_SHIPPING_MIN, AUDIENCES } from '../../utils/helpers';

export default function MiniCartDrawer() {
  const { items, updateQty, removeItem, subtotal, drawerOpen, closeDrawer } = useCart();
  const shipping = calcShipping(subtotal);
  const remaining = Math.max(0, FREE_SHIPPING_MIN - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_MIN) * 100);
  const itemCount = items.reduce((s, i) => s + i.qty, 0);
  const shippingLabel =
    shipping === 0 ? 'Free' : shipping == null ? 'At checkout' : formatMoney(shipping);

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
        className="ff-fade absolute inset-0 bg-timber-950/45 backdrop-blur-[2px]"
        aria-label="Close bag"
        onClick={closeDrawer}
      />
      <aside className="ff-sheet-in absolute inset-y-0 end-0 flex w-full max-w-[440px] flex-col bg-bone shadow-[-16px_0_48px_-24px_rgba(28,24,21,0.4)]">
        <div className="flex items-center justify-between px-6 pb-4 pt-5">
          <div>
            <h2 className="font-display text-[1.75rem] font-light leading-none text-timber-900">Your bag</h2>
            <p className="mt-1.5 text-sm text-timber-500">
              {itemCount === 0 ? 'Nothing here yet' : `${itemCount} item${itemCount === 1 ? '' : 's'}`}
            </p>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            className="ff-icon-btn text-timber-700 hover:bg-timber-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        {items.length > 0 && (
          <div className="mx-6 rounded-2xl bg-white p-4">
            <p className="flex items-center gap-2 text-[13px] text-timber-700">
              <Truck className="h-4 w-4 shrink-0 text-clay" strokeWidth={1.5} />
              {remaining > 0 ? (
                <span>
                  You’re <strong className="font-semibold text-timber-900">{formatMoney(remaining)}</strong> away from free shipping
                </span>
              ) : (
                <span className="font-semibold text-timber-900">You’ve unlocked free shipping</span>
              )}
            </p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-timber-100">
              <div
                className="h-full rounded-full bg-clay transition-[width] duration-700 ease-ff"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center pb-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-blush text-clay">
                <ShoppingBag className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <p className="mt-5 font-display text-2xl font-light text-timber-900">Your bag is empty</p>
              <p className="mt-2 text-sm text-timber-500">Start with a department below.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {AUDIENCES.map((a) => (
                  <Link key={a.value} to={`/shop?audience=${a.value}`} onClick={closeDrawer} className="ff-chip">
                    {a.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={`${item.productId}-${item.color}-${item.size}`}
                  className="flex gap-4 rounded-2xl bg-white p-3"
                >
                  <Link to={`/product/${item.productId}`} onClick={closeDrawer} className="shrink-0">
                    <img
                      src={getImageUrl(item.image, { width: 180 })}
                      alt=""
                      className="h-28 w-[5.5rem] rounded-xl bg-timber-100 object-cover"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={`/product/${item.productId}`}
                          onClick={closeDrawer}
                          className="block text-sm font-semibold leading-snug text-timber-900 line-clamp-2 hover:underline"
                        >
                          {item.name}
                        </Link>
                        <p className="mt-1 text-xs text-timber-500">
                          {[item.color, item.size && `Size ${item.size}`].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-timber-400 hover:bg-timber-50 hover:text-timber-900"
                        onClick={() => removeItem(item.productId, item.color, item.size)}
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="inline-flex items-center rounded-full border border-timber-200">
                        <button
                          type="button"
                          className="grid h-8 w-8 place-items-center rounded-full text-timber-700 hover:bg-timber-50"
                          onClick={() => updateQty(item.productId, item.color, item.size, item.qty - 1)}
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                        <span className="min-w-[1.75rem] text-center text-xs font-semibold tabular-nums">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          className="grid h-8 w-8 place-items-center rounded-full text-timber-700 hover:bg-timber-50 disabled:opacity-40"
                          disabled={item.stock > 0 && item.qty >= item.stock}
                          onClick={() => updateQty(item.productId, item.color, item.size, item.qty + 1)}
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                      <p className="text-sm font-semibold tabular-nums text-timber-900">
                        {formatMoney(item.price * item.qty)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-timber-200/70 bg-white px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-timber-500">Subtotal</span>
                <span className="tabular-nums text-timber-900">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-timber-500">Shipping</span>
                <span className={`tabular-nums ${shipping === 0 ? 'font-semibold text-clay' : 'text-timber-900'}`}>
                  {shippingLabel}
                </span>
              </div>
            </div>
            <Link to="/checkout" onClick={closeDrawer} className="btn-wheat btn-lg mt-4 w-full">
              Checkout
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </Link>
            <div className="mt-3 flex items-center justify-between">
              <Link
                to="/cart"
                onClick={closeDrawer}
                className="text-[11px] font-semibold uppercase tracking-[0.18em] text-timber-600 underline-offset-4 hover:text-timber-900 hover:underline"
              >
                View full bag
              </Link>
              <span className="flex items-center gap-3 text-[11px] text-timber-500">
                <span className="flex items-center gap-1">
                  <Banknote className="h-3.5 w-3.5" strokeWidth={1.5} /> COD
                </span>
                <span className="flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5" strokeWidth={1.5} /> Card / wallet
                </span>
              </span>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
