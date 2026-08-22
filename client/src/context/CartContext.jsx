import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getSizeStock } from '../utils/helpers';

const CartContext = createContext(null);

const itemKey = (productId, color, size) => `${productId}-${color || ''}-${size || ''}`;

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('cartItems'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('cartItems', JSON.stringify(items));
  }, [items]);

  const addItem = (product, qty = 1, color = null, size = null) => {
    setItems((prev) => {
      const key = itemKey(product.id, color, size);
      const existing = prev.find((i) => itemKey(i.productId, i.color, i.size) === key);
      const available = getSizeStock(product, size);
      const nextQty = existing
        ? existing.qty + qty
        : qty;
      const cappedQty = available > 0 ? Math.min(nextQty, available) : nextQty;
      if (existing) {
        return prev.map((i) =>
          itemKey(i.productId, i.color, i.size) === key
            ? { ...i, qty: cappedQty, stock: available || i.stock }
            : i
        );
      }
      const price =
        product.isSaleActive && product.salePrice != null ? product.salePrice : product.price;
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          image: product.photos?.[0] || '',
          price,
          qty: cappedQty,
          color,
          size,
          stock: available,
        },
      ];
    });
  };

  const updateQty = (productId, color, size, qty) => {
    setItems((prev) =>
      prev
        .map((i) =>
          itemKey(i.productId, i.color, i.size) === itemKey(productId, color, size)
            ? { ...i, qty }
            : i
        )
        .filter((i) => i.qty > 0)
    );
  };

  const removeItem = (productId, color, size) => {
    setItems((prev) =>
      prev.filter((i) => itemKey(i.productId, i.color, i.size) !== itemKey(productId, color, size))
    );
  };

  const updateItem = (productId, color, size, next, product) => {
    setItems((prev) => {
      const oldKey = itemKey(productId, color, size);
      const current = prev.find((i) => itemKey(i.productId, i.color, i.size) === oldKey);
      if (!current) return prev;

      const newColor = next.color !== undefined ? next.color : current.color;
      const newSize = next.size !== undefined ? next.size : current.size;
      const available = product ? getSizeStock(product, newSize) : current.stock;
      const requestedQty = next.qty !== undefined ? next.qty : current.qty;
      const newQty = available > 0 ? Math.min(requestedQty, available) : requestedQty;

      if (newQty < 1) {
        return prev.filter((i) => itemKey(i.productId, i.color, i.size) !== oldKey);
      }

      const newKey = itemKey(productId, newColor, newSize);
      const withoutOld = prev.filter((i) => itemKey(i.productId, i.color, i.size) !== oldKey);
      const duplicate = withoutOld.find((i) => itemKey(i.productId, i.color, i.size) === newKey);

      const price =
        product?.isSaleActive && product?.salePrice != null
          ? product.salePrice
          : product?.price ?? current.price;

      if (duplicate) {
        const mergedQty =
          available > 0
            ? Math.min(duplicate.qty + newQty, available)
            : duplicate.qty + newQty;
        return withoutOld.map((i) =>
          itemKey(i.productId, i.color, i.size) === newKey
            ? { ...i, qty: mergedQty, stock: available || i.stock, price }
            : i
        );
      }

      return [
        ...withoutOld,
        {
          ...current,
          color: newColor,
          size: newSize,
          qty: newQty,
          stock: available,
          price,
          name: product?.name ?? current.name,
          image: product?.photos?.[0] || current.image,
        },
      ];
    });
  };

  const clear = () => setItems([]);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  const value = useMemo(
    () => ({ items, addItem, updateQty, updateItem, removeItem, clear, count, subtotal }),
    [items, count, subtotal]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
