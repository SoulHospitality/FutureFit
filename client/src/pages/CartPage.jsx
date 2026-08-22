import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Pencil, Truck, ShieldCheck, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import CartEditModal from '../components/store/CartEditModal';
import {
  formatMoney,
  getImageUrl,
  calcShipping,
  FREE_SHIPPING_MIN,
} from '../utils/helpers';
import EmptyState from '../components/ui/EmptyState';

export default function CartPage() {
  const { items, updateQty, updateItem, removeItem, subtotal } = useCart();
  const navigate = useNavigate();
  const [editingItem, setEditingItem] = useState(null);
  const shipping = calcShipping(subtotal);
  const remaining = Math.max(0, FREE_SHIPPING_MIN - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_MIN) * 100);

  if (!items.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title="Your cart is empty"
          subtitle="Discover pieces made to set the tone."
          action={
            <Link to="/shop" className="btn-wheat text-[11px] uppercase tracking-[0.2em]">
              Browse collection
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-3 border-b border-timber-100 pb-6">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-timber-400">
              Bag
            </p>
            <h1 className="mt-2 font-display text-5xl font-medium tracking-tight text-timber-900">
              Cart
            </h1>
          </div>
          <Link
            to="/shop"
            className="text-[10px] font-medium uppercase tracking-[0.24em] text-timber-500 hover:text-timber-900"
          >
            Continue shopping
          </Link>
        </div>

        <div className="grid gap-12 lg:grid-cols-3">
          <div className="space-y-0 lg:col-span-2">
            {items.map((item) => (
              <div
                key={`${item.productId}-${item.color}-${item.size}`}
                className="flex gap-4 border-b border-timber-100 py-6 first:pt-0"
              >
                <Link to={`/product/${item.productId}`} className="shrink-0">
                  <img
                    src={getImageUrl(item.image, { width: 200 })}
                    alt=""
                    width={96}
                    height={112}
                    loading="lazy"
                    decoding="async"
                    className="h-28 w-24 object-cover bg-timber-100"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/product/${item.productId}`}
                        className="block truncate font-medium text-timber-900 hover:underline hover:underline-offset-4"
                      >
                        {item.name}
                      </Link>
                      <p className="mt-1 text-sm text-timber-500">
                        {[item.color, item.size && `Size ${item.size}`]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </p>
                      <p className="mt-2 text-sm tabular-nums text-timber-800">
                        {formatMoney(item.price)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className="grid h-8 w-8 place-items-center text-timber-400 transition hover:text-timber-900"
                        onClick={() => setEditingItem(item)}
                        aria-label="Edit item"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        className="grid h-8 w-8 place-items-center text-timber-400 transition hover:text-timber-900"
                        onClick={() => removeItem(item.productId, item.color, item.size)}
                        aria-label="Remove item"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="inline-flex w-fit items-center border border-timber-200">
                    <button
                      type="button"
                      className="px-2.5 py-2 text-timber-700 hover:bg-timber-50"
                      onClick={() =>
                        updateQty(
                          item.productId,
                          item.color,
                          item.size,
                          Math.max(1, item.qty - 1)
                        )
                      }
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                    <span className="min-w-[2rem] text-center text-sm font-medium tabular-nums">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      className="px-2.5 py-2 text-timber-700 hover:bg-timber-50 disabled:opacity-40"
                      onClick={() =>
                        updateQty(
                          item.productId,
                          item.color,
                          item.size,
                          item.stock != null
                            ? Math.min(item.stock, item.qty + 1)
                            : item.qty + 1
                        )
                      }
                      disabled={item.stock != null && item.qty >= item.stock}
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                    </div>
                    <button
                      type="button"
                      className="text-[10px] font-medium uppercase tracking-[0.18em] text-timber-500 underline-offset-4 hover:text-timber-900 hover:underline"
                      onClick={() => setEditingItem(item)}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="h-fit space-y-6 border border-timber-200 p-6 lg:sticky lg:top-28">
            <div className="border-b border-timber-100 pb-5">
              {remaining > 0 ? (
                <>
                  <p className="text-sm text-timber-700">
                    You’re <span className="font-medium">{formatMoney(remaining)}</span> away from
                    free shipping
                  </p>
                  <div className="mt-3 h-px overflow-hidden bg-timber-100">
                    <div
                      className="h-full bg-timber-900 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm font-medium text-timber-800">You’ve unlocked free shipping</p>
              )}
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-timber-500">Subtotal</span>
              <span className="tabular-nums">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-timber-500">Shipping</span>
              <span className="tabular-nums">{shipping === 0 ? 'Free' : formatMoney(shipping)}</span>
            </div>
            <div className="flex justify-between border-t border-timber-100 pt-4 text-base font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(subtotal + shipping)}</span>
            </div>

            <button
              type="button"
              className="btn-wheat w-full py-3.5 text-[11px] uppercase tracking-[0.22em]"
              onClick={() => navigate('/checkout')}
            >
              Checkout
            </button>

            <div className="space-y-2 text-xs text-timber-500">
              <p className="flex items-center gap-2">
                <Truck className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                Ships in 2–3 business days · Cash on delivery
              </p>
              <p className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                <Link to="/returns" className="underline-offset-4 hover:underline">
                  14-day returns
                </Link>{' '}
                on unworn items
              </p>
            </div>
          </div>
        </div>
      </div>

      <CartEditModal
        item={editingItem}
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        onSave={(next, product) => {
          if (!editingItem) return;
          updateItem(
            editingItem.productId,
            editingItem.color,
            editingItem.size,
            next,
            product
          );
        }}
      />
    </div>
  );
}
