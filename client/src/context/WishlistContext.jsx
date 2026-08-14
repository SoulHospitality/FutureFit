import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('wishlistItems'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('wishlistItems', JSON.stringify(items));
  }, [items]);

  const isSaved = (productId) => items.some((i) => i.id === productId);

  const toggle = (product) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === product.id)) {
        return prev.filter((i) => i.id !== product.id);
      }
      const price =
        product.isSaleActive && product.salePrice != null ? product.salePrice : product.price;
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          image: product.photos?.[0] || '',
          price,
          originalPrice: product.price,
          isSaleActive: Boolean(product.isSaleActive),
          salePrice: product.salePrice ?? null,
          type: product.type,
          colors: product.colors || [],
          stock: product.stock,
          photos: product.photos || [],
        },
      ];
    });
  };

  const remove = (productId) => {
    setItems((prev) => prev.filter((i) => i.id !== productId));
  };

  const clear = () => setItems([]);

  const value = useMemo(
    () => ({ items, count: items.length, isSaved, toggle, remove, clear }),
    [items]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export const useWishlist = () => useContext(WishlistContext);
