import { createContext, useContext, useEffect, useMemo, useState } from 'react';

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
      if (existing) {
        return prev.map((i) =>
          itemKey(i.productId, i.color, i.size) === key ? { ...i, qty: i.qty + qty } : i
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
          qty,
          color,
          size,
          stock: product.stock,
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

  const clear = () => setItems([]);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  const value = useMemo(
    () => ({ items, addItem, updateQty, removeItem, clear, count, subtotal }),
    [items, count, subtotal]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
