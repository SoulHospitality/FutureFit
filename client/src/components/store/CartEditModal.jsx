import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import Modal from '../ui/Modal';
import BrandLoader from '../ui/BrandLoader';
import { getVariantStock, sizesForColor } from '../../utils/helpers';

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
        const nextColor =
          colors.length && !colors.includes(item.color || '')
            ? colors[0]
            : item.color || colors[0] || '';
        setColor(nextColor);
        const sizes = sizesForColor(data, nextColor);
        const nextSize =
          sizes.find((s) => s === item.size && getVariantStock(data, nextColor, s) > 0) ||
          sizes.find((s) => getVariantStock(data, nextColor, s) > 0) ||
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

  const sizeOptions = product ? sizesForColor(product, color) : [];
  const available = product ? getVariantStock(product, color, size) : item.stock;
  const canSave = !loading && qty >= 1 && (available == null || available >= 1);

  const handleSave = () => {
    if (qty < 1) return;
    if (product && size && getVariantStock(product, color, size) < 1) {
      toast.error(size ? `Size ${size} is out of stock` : 'Out of stock');
      return;
    }
    onSave(
      {
        color: product?.colors?.length ? color : item.color,
        size: sizeOptions.length ? size : item.size,
        qty: available > 0 ? Math.min(qty, available) : qty,
      },
      product
    );
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit item">
      {loading ? (
        <div className="grid place-items-center py-10">
          <BrandLoader size="sm" label="Loading" />
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
                    onClick={() => {
                      setColor(c);
                      const nextSizes = sizesForColor(product, c);
                      const next =
                        nextSizes.find((s) => getVariantStock(product, c, s) > 0) ||
                        nextSizes[0] ||
                        '';
                      setSize(next);
                      setQty((q) => {
                        const stock = getVariantStock(product, c, next);
                        return stock > 0 ? Math.min(q, stock) : q;
                      });
                    }}
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

          {sizeOptions.length > 0 && (
            <div>
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.24em] text-timber-700">
                Size
              </p>
              <div className="flex flex-wrap gap-2">
                {sizeOptions.map((s) => {
                  const sizeQty = getVariantStock(product, color, s);
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
                className="grid h-10 w-10 place-items-center text-timber-700 hover:bg-timber-50"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <span className="min-w-[2.5rem] text-center text-sm font-semibold tabular-nums">
                {qty}
              </span>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center text-timber-700 hover:bg-timber-50 disabled:opacity-40"
                onClick={() =>
                  setQty((q) => Math.min(available > 0 ? available : q + 1, q + 1))
                }
                disabled={available > 0 && qty >= available}
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            {available > 0 && available <= 5 ? (
              <p className="mt-2 text-xs text-timber-500">Only {available} left</p>
            ) : null}
          </div>

          <button
            type="button"
            className="btn-wheat w-full"
            disabled={!canSave}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      )}
    </Modal>
  );
}
