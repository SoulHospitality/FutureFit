import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ChevronDown,
  Heart,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import api from '../api/axios';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { formatMoney, getImageUrl, getSizeStock, totalStock, PRODUCT_TYPES, FREE_SHIPPING_MIN, audienceLabel, categoryLabel } from '../utils/helpers';
import StarRating from '../components/store/StarRating';

function Accordion({ title, open, onToggle, children }) {
  return (
    <div className="border-b border-timber-200">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-timber-800">
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-timber-500 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.5}
        />
      </button>
      {open && <div className="pb-6 text-sm leading-relaxed text-timber-600">{children}</div>}
    </div>
  );
}

const sizeGuideByType = {
  boxers: [
    ['Size', 'S', 'M', 'L', 'XL'],
    ['Waist (cm)', '70–78', '78–86', '86–94', '94–104'],
  ],
  briefs: [
    ['Size', 'S', 'M', 'L', 'XL'],
    ['Waist (cm)', '70–78', '78–86', '86–94', '94–104'],
  ],
  trunks: [
    ['Size', 'S', 'M', 'L', 'XL'],
    ['Waist (cm)', '70–78', '78–86', '86–94', '94–104'],
  ],
  undershirt: [
    ['Size', 'S', 'M', 'L', 'XL'],
    ['Chest (cm)', '88–94', '94–100', '100–106', '106–114'],
  ],
  default: [
    ['Tip', 'Measure against a piece you already own.'],
    ['Fit', 'True to size for most customers — check the chart if between sizes.'],
  ],
};

const careByType = {
  boxers: [
    'Wash cold 30°C max',
    'Wash inside out',
    'Gentle cycle only',
    'Do not tumble dry',
    'Air dry only',
  ],
  briefs: [
    'Wash cold 30°C max',
    'Wash inside out',
    'Gentle cycle only',
    'Do not tumble dry',
    'Air dry only',
  ],
  trunks: [
    'Wash cold 30°C max',
    'Wash inside out',
    'Gentle cycle only',
    'Do not tumble dry',
    'Air dry only',
  ],
  undershirt: [
    'Wash cold 30°C max',
    'Wash inside out',
    'Avoid fabric softener on elastics',
    'Do not tumble dry',
    'Air dry only',
  ],
  socks: [
    'Wash cold 30°C max',
    'Wash inside out',
    'Gentle cycle only',
    'Do not tumble dry',
    'Air dry only',
  ],
  default: [
    'Follow the care label',
    'Wash cold when needed',
    'Store in a cool, dry place',
    'Avoid prolonged direct sunlight',
  ],
};

const fitTipByType = {
  boxers: 'True to size — size up for a looser lounge fit.',
  briefs: 'True to size for a secure everyday fit.',
  trunks: 'True to size — between sizes? choose the larger.',
  undershirt: 'True to size for a clean base layer.',
  default: 'True to size for most customers.',
};

function TrustRow() {
  return (
    <ul className="mt-6 space-y-3 border-t border-timber-100 pt-6 text-sm text-timber-500">
      <li className="flex items-center gap-3">
        <Truck className="h-4 w-4 shrink-0 text-timber-400" strokeWidth={1.5} />
        Ships in 2–3 business days · Cash on delivery
      </li>
      <li className="flex items-center gap-3">
        <ShieldCheck className="h-4 w-4 shrink-0 text-timber-400" strokeWidth={1.5} />
        Free shipping on orders over {formatMoney(FREE_SHIPPING_MIN)}
      </li>
      <li className="flex items-center gap-3">
        <RefreshCw className="h-4 w-4 shrink-0 text-timber-400" strokeWidth={1.5} />
        <Link to="/returns" className="underline-offset-4 hover:underline">
          14-day returns
        </Link>{' '}
        on unworn items
      </li>
    </ul>
  );
}

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isSaved, toggle } = useWishlist();
  const [product, setProduct] = useState(null);
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [activePhoto, setActivePhoto] = useState(0);
  const [openSection, setOpenSection] = useState('details');
  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [sendingReview, setSendingReview] = useState(false);

  useEffect(() => {
    api.get(`/products/${id}`).then((r) => {
      setProduct(r.data);
      setColor(r.data.colors?.[0] || '');
      const firstInStock =
        (r.data.sizes || []).find((s) => getSizeStock(r.data, s) > 0) || r.data.sizes?.[0] || '';
      setSize(firstInStock);
      setActivePhoto(0);
      setQty(1);
    });
  }, [id]);

  const detailBullets = useMemo(() => {
    if (!product?.description) return [];
    return product.description
      .split(/\n|•|\u2022/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [product]);

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center text-timber-400">Loading…</div>
    );
  }

  const price =
    product.isSaleActive && product.salePrice != null ? product.salePrice : product.price;
  const photos = product.photos?.length ? product.photos : [''];
  const typeLabel = categoryLabel(product) ||
    PRODUCT_TYPES.find((t) => t.value === product.type)?.label ||
    product.type.replace('_', ' ');
  const available = getSizeStock(product, size);
  const productStock = totalStock(product);
  const lowStock = available > 0 && available <= 5;
  const sizeGuide = sizeGuideByType[product.type] || sizeGuideByType.default;
  const care = careByType[product.type] || careByType.default;
  const fitTip = fitTipByType[product.type] || fitTipByType.default;
  const liked = isSaved(product.id);
  const canAdd = available >= 1;

  const addToCart = () => {
    if (available < 1) {
      toast.error(size ? `Size ${size} is out of stock` : 'Out of stock');
      return false;
    }
    if (product.colors?.length && !color) {
      toast.error('Select a color');
      return false;
    }
    if (product.sizes?.length && !size) {
      toast.error('Select a size');
      return false;
    }
    addItem(product, qty, color || null, size || null);
    return true;
  };

  const add = () => {
    if (!addToCart()) return;
    toast.success(
      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>Added to cart</span>
        <Link to="/cart" className="font-semibold underline underline-offset-2">
          View cart
        </Link>
        <Link to="/checkout" className="font-semibold underline underline-offset-2">
          Checkout
        </Link>
      </span>
    );
  };

  const buyNow = () => {
    if (!addToCart()) return;
    navigate('/checkout');
  };

  const toggleSection = (key) =>
    setOpenSection((current) => (current === key ? '' : key));

  return (
    <div className="bg-white pb-24 lg:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-14">
        <nav className="mb-8 text-[10px] font-medium uppercase tracking-[0.24em] text-timber-400">
          <Link to="/shop" className="hover:text-timber-800">
            Shop
          </Link>
          {product.audience && (
            <>
              <span className="mx-3 text-timber-200">/</span>
              <Link
                to={`/shop?audience=${product.audience}`}
                className="hover:text-timber-800"
              >
                {audienceLabel(product.audience)}
              </Link>
            </>
          )}
          {product.category?.slug && (
            <>
              <span className="mx-3 text-timber-200">/</span>
              <Link
                to={`/shop?audience=${product.audience || 'men'}&category=${product.category.slug}`}
                className="hover:text-timber-800"
              >
                {product.category.name}
              </Link>
            </>
          )}
          <span className="mx-3 text-timber-200">/</span>
          <span className="text-timber-600">{product.name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="space-y-3 lg:col-span-7">
            <div className="relative aspect-[3/4] overflow-hidden bg-timber-100 sm:aspect-[4/5]">
              {photos[activePhoto] ? (
                <img
                  src={getImageUrl(photos[activePhoto])}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center text-timber-400">No photo</div>
              )}
              {product.isSaleActive && (
                <span className="absolute left-0 top-0 bg-timber-900 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-white">
                  Sale
                </span>
              )}
              <button
                type="button"
                onClick={() => toggle(product)}
                className="absolute right-4 top-4 grid h-10 w-10 place-items-center bg-white/95"
                aria-label={liked ? 'Remove from wishlist' : 'Save to wishlist'}
              >
                <Heart
                  className={`h-5 w-5 ${
                    liked ? 'fill-timber-900 text-timber-900' : 'text-timber-700'
                  }`}
                  strokeWidth={1.5}
                />
              </button>
            </div>

            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((p, i) => (
                  <button
                    key={`${p}-${i}`}
                    type="button"
                    onClick={() => setActivePhoto(i)}
                    className={`h-20 w-16 shrink-0 overflow-hidden border transition sm:w-20 ${
                      i === activePhoto
                        ? 'border-timber-900'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={getImageUrl(p)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 lg:sticky lg:top-28 lg:self-start">
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-timber-400">
              {typeLabel}
            </p>
            <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-timber-900 sm:text-5xl">
              {product.name}
            </h1>

            <div className="mt-5 flex items-baseline gap-3">
              <span className="text-xl tabular-nums text-timber-900">{formatMoney(price)}</span>
              {product.isSaleActive && product.salePrice != null && (
                <span className="text-sm text-timber-400 line-through">
                  {formatMoney(product.price)}
                </span>
              )}
            </div>
            {product.reviewCount > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <StarRating value={product.ratingAvg} readOnly size={16} />
                <span className="text-sm text-timber-500">
                  {product.ratingAvg} · {product.reviewCount} review
                  {product.reviewCount === 1 ? '' : 's'}
                </span>
              </div>
            )}

            {product.colors?.length > 0 && (
              <div className="mt-10">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-timber-700">
                    Colour
                  </span>
                  <span className="text-sm text-timber-500">{color}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`border px-4 py-2.5 text-sm transition ${
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

            {product.sizes?.length > 0 && (
              <div className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-timber-700">
                    Size
                  </span>
                  <button
                    type="button"
                    className="text-[10px] uppercase tracking-[0.18em] text-timber-500 underline-offset-4 hover:underline"
                    onClick={() => setOpenSection('size')}
                  >
                    Size chart
                  </button>
                </div>
                <p className="mb-3 text-sm text-timber-500">{fitTip}</p>
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
                          setQty(1);
                        }}
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

            <div className="mt-8">
              <span className="mb-3 block text-[10px] font-medium uppercase tracking-[0.24em] text-timber-700">
                Quantity
              </span>
              <div className="inline-flex items-center border border-timber-200 bg-white">
                <button
                  type="button"
                  className="px-3 py-2.5 text-timber-700 hover:bg-timber-50"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  <Minus className="h-4 w-4" strokeWidth={1.5} />
                </button>
                <span className="min-w-[2.5rem] text-center text-sm font-medium tabular-nums">
                  {qty}
                </span>
                <button
                  type="button"
                  className="px-3 py-2.5 text-timber-700 hover:bg-timber-50"
                  onClick={() => setQty((q) => Math.min(available || 1, q + 1))}
                  disabled={qty >= available}
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {lowStock && (
              <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.18em] text-timber-600">
                Low stock — only {available} left{size ? ` in ${size}` : ''}
              </p>
            )}
            {productStock < 1 && (
              <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.18em] text-red-600">
                Out of stock
              </p>
            )}
            {available < 1 && productStock >= 1 && size && (
              <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.18em] text-red-600">
                Size {size} is out of stock
              </p>
            )}
            {available > 5 && (
              <p className="mt-5 text-sm text-timber-500">In stock</p>
            )}

            <div className="mt-8 hidden gap-3 lg:flex">
              <button
                type="button"
                className="btn-outline flex-1 py-4 text-[11px] font-medium uppercase tracking-[0.22em]"
                onClick={add}
                disabled={!canAdd}
              >
                Add to cart
              </button>
              <button
                type="button"
                className="btn-wheat flex-1 py-4 text-[11px] font-medium uppercase tracking-[0.22em]"
                onClick={buyNow}
                disabled={!canAdd}
              >
                Buy now
              </button>
            </div>

            <TrustRow />

            <div className="mt-10">
              <Accordion
                title="Product details"
                open={openSection === 'details'}
                onToggle={() => toggleSection('details')}
              >
                {detailBullets.length > 1 ? (
                  <ul className="space-y-2">
                    {detailBullets.map((line) => (
                      <li key={line} className="flex gap-3">
                        <span className="mt-2 h-px w-3 shrink-0 bg-timber-400" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{product.description}</p>
                )}
              </Accordion>

              <Accordion
                title="Size chart"
                open={openSection === 'size'}
                onToggle={() => toggleSection('size')}
              >
                {Array.isArray(sizeGuide[0]) && sizeGuide[0].length > 2 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[280px] text-left text-xs">
                      <tbody>
                        {sizeGuide.map((row) => (
                          <tr key={row[0]} className="border-b border-timber-100">
                            {row.map((cell, i) => (
                              <td
                                key={`${row[0]}-${i}`}
                                className={`px-2 py-2.5 ${
                                  i === 0 ? 'font-medium text-timber-800' : 'text-timber-600'
                                }`}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {sizeGuide.map(([label, value]) => (
                      <li key={label}>
                        <span className="font-medium text-timber-800">{label}: </span>
                        {value}
                      </li>
                    ))}
                  </ul>
                )}
                {product.sizes?.length > 0 && (
                  <p className="mt-3 text-timber-500">
                    Available sizes: {product.sizes.join(', ')}
                  </p>
                )}
              </Accordion>

              <Accordion
                title="Care instructions"
                open={openSection === 'care'}
                onToggle={() => toggleSection('care')}
              >
                <ul className="space-y-2">
                  {care.map((line) => (
                    <li key={line} className="text-[12px] uppercase tracking-[0.12em]">
                      {line}
                    </li>
                  ))}
                </ul>
              </Accordion>

              <Accordion
                title="Delivery"
                open={openSection === 'delivery'}
                onToggle={() => toggleSection('delivery')}
              >
                <p className="text-[12px] uppercase tracking-[0.12em]">
                  Orders take 2–3 business days
                </p>
                <p className="mt-2 text-timber-500">
                  Cash on delivery, InstaPay, and Vodafone Cash available at checkout. Free shipping
                  on orders over EGP 2,000.
                </p>
              </Accordion>
            </div>
          </div>
        </div>

        <section className="mt-16 border-t border-timber-100 pt-12">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-timber-400">
            Reviews
          </p>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-timber-900">
            What customers say
          </h2>
          <div className="mt-10 grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7 space-y-8">
              {(product.reviews || []).length === 0 ? (
                <p className="text-sm text-timber-500">No reviews yet — be the first.</p>
              ) : (
                (product.reviews || []).map((r) => (
                  <article key={r.id} className="border-b border-timber-100 pb-6">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-timber-900">{r.name}</p>
                      <StarRating value={r.rating} readOnly size={14} />
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-timber-600">{r.comment}</p>
                  </article>
                ))
              )}
            </div>
            <form
              className="lg:col-span-5 space-y-4 border border-timber-200 p-6"
              onSubmit={async (e) => {
                e.preventDefault();
                setSendingReview(true);
                try {
                  await api.post(`/products/${product.id}/reviews`, {
                    name: reviewName,
                    rating: reviewRating,
                    comment: reviewComment,
                  });
                  toast.success('Thank you for your review');
                  setReviewName('');
                  setReviewComment('');
                  setReviewRating(5);
                  const { data } = await api.get(`/products/${product.id}`);
                  setProduct(data);
                } catch (err) {
                  toast.error(err.response?.data?.message || 'Could not post review');
                } finally {
                  setSendingReview(false);
                }
              }}
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-timber-700">
                Write a review
              </p>
              <div>
                <label className="label">Name</label>
                <input
                  required
                  className="input"
                  value={reviewName}
                  onChange={(e) => setReviewName(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Rating</label>
                <StarRating value={reviewRating} onChange={setReviewRating} size={20} />
              </div>
              <div>
                <label className="label">Comment</label>
                <textarea
                  required
                  rows={4}
                  className="input"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-wheat w-full" disabled={sendingReview}>
                {sendingReview ? 'Sending…' : 'Submit review'}
              </button>
            </form>
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-timber-200 bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <button
            type="button"
            className="btn-outline min-h-12 flex-1 px-3 py-3 text-[10px] font-medium uppercase tracking-[0.16em]"
            onClick={add}
            disabled={!canAdd}
          >
            Add to cart
          </button>
          <button
            type="button"
            className="btn-wheat min-h-12 flex-1 px-3 py-3 text-[10px] font-medium uppercase tracking-[0.16em]"
            onClick={buyNow}
            disabled={!canAdd}
          >
            Buy now
          </button>
        </div>
      </div>
    </div>
  );
}
