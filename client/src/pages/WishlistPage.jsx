import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/store/ProductCard';
import EmptyState from '../components/ui/EmptyState';
import { toast } from 'react-toastify';

export default function WishlistPage() {
  const { items, remove, clear } = useWishlist();
  const { addItem } = useCart();

  if (!items.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title="Your wishlist is empty"
          subtitle="Tap the heart on any piece to save it here."
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
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-timber-100 pb-6">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-timber-400">
              Saved
            </p>
            <h1 className="mt-2 font-display text-5xl font-medium tracking-tight text-timber-900">
              Wishlist
            </h1>
            <p className="mt-2 text-sm text-timber-500">
              {items.length} saved {items.length === 1 ? 'piece' : 'pieces'}
            </p>
          </div>
          <button
            type="button"
            className="btn-outline btn-sm text-[10px] uppercase tracking-[0.18em]"
            onClick={clear}
          >
            Clear all
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
          {items.map((item) => (
            <div key={item.id} className="relative">
              <ProductCard
                product={{
                  id: item.id,
                  name: item.name,
                  photos: item.photos?.length ? item.photos : [item.image],
                  price: item.originalPrice ?? item.price,
                  salePrice: item.salePrice,
                  isSaleActive: item.isSaleActive,
                  type: item.type,
                  colors: item.colors,
                  stock: item.stock,
                }}
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn-wheat btn-sm flex-1 text-[10px] uppercase tracking-[0.16em]"
                  disabled={item.stock < 1}
                  onClick={() => {
                    addItem(
                      {
                        id: item.id,
                        name: item.name,
                        photos: item.photos?.length ? item.photos : [item.image],
                        price: item.originalPrice ?? item.price,
                        salePrice: item.salePrice,
                        isSaleActive: item.isSaleActive,
                        stock: item.stock,
                      },
                      1
                    );
                    toast.success('Added to cart');
                  }}
                >
                  {item.stock < 1 ? 'Out of stock' : 'Add to cart'}
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm border border-timber-200"
                  aria-label="Remove from wishlist"
                  onClick={() => remove(item.id)}
                >
                  <Heart className="h-4 w-4 fill-timber-900 text-timber-900" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
