import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import Modal from '../ui/Modal';
import { getSizeStock } from '../../utils/helpers';

export default function CartEditModal({ item, open, onClose, onSave }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [color, setColor] = useState(item?.color || '');
  const [size, setSize] = useState(item?.size || '');
  const [qty, setQty] = useState(item?.qty || 1);

  useEffect(() => {
    if (!open || !item) return undefined;
    setColor(item.color || '');
    setSize(item.size || '');
    setQty(item.qty || 1);
    setLoading(true);
    setProduct(null);
    let cancelled = false;
    api
      .get(`/products/${item.productId}`)
      .then((r) => {
        if (cancelled) return;
        const data = r.data;
        setProduct(data);
        const colors = data.colors || [];
        const sizes = data.sizes || [];
        setColor((c) => (colors.length && !colors.includes(c) ? colors[0] : c));
        const nextSize =
          sizes.find((s) => s === item.size && getSizeStock(data, s) > 0) ||
          sizes.find((s) => getSizeStock(data, s) > 0) ||
          item.size ||
          sizes[0] ||
          '';
        setSize(nextSize);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load product details');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, item]);

  if (!item) return null;

  const available = product ? getSizeStock(product, size) : item.stock;
  const canSave = !loading && qty >= 1 && (available == null || available >= 1);

  const handleSave = () => {
    if (qty < 1) return;
    if (product && size && getSizeStock(product, size) < 1) {
      toast.error(size ? `Size ${size} is out of stock` : 'Out of stock');
      return;
    }
    onSave(
      {
        color: product?.colors?.length ? color : item.color,
        size: product?.sizes?.length ? size : item.size,
        qty: available > 0 ? Math.min(qty, available) : qty,
      },
      product
    );
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit item">
      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-4 w-1/3 bg-timber-100" />
          <div className="h-10 w-full bg-timber-100" />
          <div className="h-10 w-full bg-timber-100" />
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm font-medium text-timber-900">{item.name}</p>

          {product?.colors?.length > 0 && (
            <div>
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.24em] text-timber-700">
                Colour
              </p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`border px-3 py-2 text-sm transition ${
                      color === c
                        ? 'border-timber-900 bg-timber-900 text-white'
                        : 'border-timber-200 bg-white text-timber-800 hover:border-timber-900'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product?.sizes?.length > 0 && (
            <div>
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.24em] text-timber-700">
                Size
              </p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => {
                  const sizeQty = getSizeStock(product, s);
                  const soldOut = sizeQty < 1;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={soldOut}
                      onClick={() => {
                        setSize(s);
                        setQty((q) => (sizeQty > 0 ? Math.min(q, sizeQty) : q));
                      }}
                      className={`min-w-[2.75rem] border px-3 py-2 text-sm font-medium transition ${
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

          <div>
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.24em] text-timber-700">
              Quantity
            </p>
            <div className="inline-flex items-center border border-timber-200">
              <button
                type="button"
                className="px-3 py-2 text-timber-700 hover:bg-timber-50"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <span className="min-w-[2.5rem] text-center text-sm font-medium tabular-nums">
                {qty}
              </span>
              <button
                type="button"
                className="px-3 py-2 text-timber-700 hover:bg-timber-50 disabled:opacity-40"
                onClick={() =>
                  setQty((q) =>
                    available > 0 ? Math.min(available, q + 1) : q + 1
                  )
                }
                disabled={available > 0 && qty >= available}
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            {available > 0 && available <= 5 && (
              <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-timber-500">
                Only {available} left
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline flex-1" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-wheat flex-1"
              onClick={handleSave}
              disabled={!canSave}
            >
              Save changes
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
