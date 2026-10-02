import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Banknote,
  ChevronDown,
  Heart,
  Minus,
  Plus,
  RefreshCw,
  Truck,
} from 'lucide-react';
import api from '../api/axios';
import { useCart } from '../context/CartContext';
import { trackViewContent } from '../utils/tracking';
import { snippet, usePageMeta } from '../utils/seo';
import BrandLoader from '../components/ui/BrandLoader';
import { useWishlist } from '../context/WishlistContext';
import {
  formatMoney,
  getImageUrl,
  getSizeStock,
  totalStock,
  PRODUCT_TYPES,
  FREE_SHIPPING_MIN,
  audienceLabel,
  categoryLabel,
  colorSwatchStyle,
  photosForColor,
  preloadImages,
  asArray,
} from '../utils/helpers';
import StarRating from '../components/store/StarRating';
import ProductCard from '../components/store/ProductCard';
import ProductLightbox from '../components/store/ProductLightbox';

function Accordion({ title, open, onToggle, children }) {
  return (
    <div className="border-b border-timber-200/80">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-[15px] font-semibold text-timber-900">{title}</span>
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
  const items = [
    { icon: Truck, title: 'Fast delivery', body: `2–3 business days · free over ${formatMoney(FREE_SHIPPING_MIN)}` },
    { icon: Banknote, title: 'Cash on delivery', body: 'Or pay by card / wallet' },
    { icon: RefreshCw, title: '14-day returns', body: 'On unworn items', to: '/returns' },
  ];
  return (
    <ul className="mt-6 grid grid-cols-3 gap-2">
      {items.map((item) => {
        const { title, body, to } = item;
        const Icon = item.icon;
        const inner = (
          <>
            <Icon className="h-5 w-5 text-clay" strokeWidth={1.5} />
            <span className="mt-2.5 block text-[12.5px] font-semibold leading-tight text-timber-900">{title}</span>
            <span className="mt-1 block text-[11.5px] leading-snug text-timber-500">{body}</span>
          </>
        );
        return (
          <li key={title} className="rounded-2xl bg-white p-3.5 sm:p-4">
            {to ? <Link to={to}>{inner}</Link> : inner}
          </li>
        );
      })}
    </ul>
  );
}

/** Page title/description + schema.org Product so Google can show price, stock and stars. */
const productMeta = (product) => {
  const origin = window.location.origin;
  const url = `${origin}/product/${product.id}`;
  const onSale = product.isSaleActive && product.salePrice != null;
  const price = Number(onSale ? product.salePrice : product.price) || 0;
  const images = (product.photos || [])
    .filter(Boolean)
    .slice(0, 6)
    .map((src) => {
      const u = getImageUrl(src, { width: 1200 });
      return /^https?:\/\//i.test(u) ? u : `${origin}${u.startsWith('/') ? '' : '/'}${u}`;
    });
  const description = snippet(product.description || product.name, 300);
  return {
    title: product.name,
    description: `${snippet(product.description || product.name, 120)} — EGP ${price.toLocaleString('en-EG')} · Cash on delivery across Egypt.`,
    image: images[0],
    path: `/product/${product.id}`,
    type: 'product',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description,
      image: images,
      sku: String(product.id),
      brand: { '@type': 'Brand', name: 'FutureFit' },
      ...(product.category?.name ? { category: product.category.name } : {}),
      offers: {
        '@type': 'Offer',
        url,
        priceCurrency: 'EGP',
        price: price.toFixed(2),
        availability:
          totalStock(product) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
      },
      ...(product.reviewCount > 0 && product.ratingAvg
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: Number(product.ratingAvg).toFixed(1),
              reviewCount: product.reviewCount,
            },
          }
        : {}),
    },
  };
};

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, openDrawer } = useCart();
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
  const [related, setRelated] = useState([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const railRef = useRef(null);

  const selectColor = (c) => {
    setColor(c);
    setActivePhoto(0);
    railRef.current?.scrollTo({ left: 0 });
  };

  const onRailScroll = () => {
    const rail = railRef.current;
    const first = rail?.firstElementChild;
    if (!rail || !first) return;
    const step = first.getBoundingClientRect().width + 8;
    const i = Math.round(rail.scrollLeft / step);
    if (i !== activePhoto) setActivePhoto(i);
  };

  useEffect(() => {
    setRelated([]);
    api.get(`/products/${id}`).then((r) => {
      setProduct(r.data);
      trackViewContent(r.data);
      const firstColor = r.data.colors?.[0] || '';
      setColor(firstColor);
      const firstInStock =
        (r.data.sizes || []).find((s) => getSizeStock(r.data, s) > 0) || r.data.sizes?.[0] || '';
      setSize(firstInStock);
      setActivePhoto(0);
      setQty(1);
    });
  }, [id]);

  useEffect(() => {
    if (!product?.id) return undefined;
    const query = new URLSearchParams({ limit: '8' });
    if (product.audience) query.set('audience', product.audience);
    if (product.type) query.set('type', product.type);
    let cancelled = false;
    api
      .get(`/products?${query.toString()}`)
      .then((r) => {
        if (cancelled) return;
        const list = asArray(r.data)
          .filter((p) => p.id !== product.id)
          .slice(0, 4);
        setRelated(list);
      })
      .catch(() => {
        if (!cancelled) setRelated([]);
      });
    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.audience, product?.type]);

  const detailBullets = useMemo(() => {
    if (!product?.description) return [];
    return product.description
      .split(/\n|•|\u2022/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [product]);

  const photos = useMemo(() => {
    const list = photosForColor(product, color);
    return list.length ? list : [''];
  }, [product, color]);

  const galleryUrls = useMemo(
    () => photos.filter(Boolean).map((src) => getImageUrl(src, { width: 900 })),
    [photos]
  );

  useEffect(() => {
    if (!galleryUrls.length) return;
    preloadImages(galleryUrls);
    // Warm lightbox sizes for nearby shots after idle
    const t = window.setTimeout(() => {
      preloadImages(
        photos.filter(Boolean).map((src) => getImageUrl(src, { width: 1600 }))
      );
    }, 600);
    return () => window.clearTimeout(t);
  }, [galleryUrls, photos]);

  usePageMeta(product ? productMeta(product) : { path: `/product/${id}` });

  if (!product) {
    return <BrandLoader fullPage size="lg" label="Loading product" />;
  }

  const price =
    product.isSaleActive && product.salePrice != null ? product.salePrice : product.price;
  const photoIdx = Math.min(activePhoto, Math.max(0, photos.length - 1));
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
    openDrawer();
  };

  const buyNow = () => {
    if (!addToCart()) return;
    navigate('/checkout');
  };

  const toggleSection = (key) =>
    setOpenSection((current) => (current === key ? '' : key));

  return (
    <div className="bg-bone pb-24 lg:pb-0">
      <div className="ff-container py-6 lg:py-10">
        <nav className="mb-6 text-[12px] text-timber-400" aria-label="Breadcrumb">
          <Link to="/shop" className="hover:text-timber-800">
            Shop
          </Link>
          {product.audience && (
            <>
              <span className="mx-2 text-timber-300">/</span>
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
              <span className="mx-2 text-timber-300">/</span>
              <Link
                to={`/shop?audience=${product.audience || 'men'}&category=${product.category.slug}`}
                className="hover:text-timber-800"
              >
                {product.category.name}
              </Link>
            </>
          )}
          <span className="mx-2 text-timber-300">/</span>
          <span className="text-timber-600">{product.name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            {galleryUrls.length ? (
              <>
                {/* Mobile — swipe carousel */}
                <div className="relative lg:hidden">
                  <div
                    ref={railRef}
                    onScroll={onRailScroll}
                    className="ff-scroll-x -mx-5 gap-2 scroll-px-5 px-5"
                  >
                    {galleryUrls.map((src, i) => (
                      <button
                        key={`${src}-${i}`}
                        type="button"
                        onClick={() => {
                          setActivePhoto(i);
                          setLightboxOpen(true);
                        }}
                        className={`relative aspect-[4/5] shrink-0 snap-start overflow-hidden rounded-2xl bg-timber-100 ${
                          galleryUrls.length > 1 ? 'w-[86%]' : 'w-full'
                        }`}
                        aria-label={`View photo ${i + 1} larger`}
                      >
                        <img
                          src={src}
                          alt={i === 0 ? product.name : ''}
                          width={900}
                          height={1125}
                          loading={i === 0 ? 'eager' : 'lazy'}
                          fetchPriority={i === 0 ? 'high' : 'auto'}
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                  {galleryUrls.length > 1 && (
                    <div className="mt-3 flex justify-center gap-1.5">
                      {galleryUrls.map((src, i) => (
                        <span
                          key={`dot-${src}-${i}`}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            i === photoIdx ? 'w-6 bg-timber-900' : 'w-1.5 bg-timber-300'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Desktop — editorial grid */}
                <div className="hidden grid-cols-2 gap-3 lg:grid">
                  {galleryUrls.slice(0, 6).map((src, i) => (
                    <button
                      key={`${src}-${i}`}
                      type="button"
                      onClick={() => {
                        setActivePhoto(i);
                        setLightboxOpen(true);
                      }}
                      className={`group relative cursor-zoom-in overflow-hidden rounded-2xl bg-timber-100 ${
                        galleryUrls.length === 1 ? 'col-span-2 aspect-[4/5]' : 'aspect-[3/4]'
                      }`}
                      aria-label={`View photo ${i + 1} larger`}
                    >
                      <img
                        src={src}
                        alt={i === 0 ? product.name : ''}
                        width={900}
                        height={1200}
                        loading={i < 2 ? 'eager' : 'lazy'}
                        fetchPriority={i === 0 ? 'high' : 'auto'}
                        decoding="async"
                        className="ff-img-zoom absolute inset-0 h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="grid aspect-[4/5] place-items-center rounded-2xl bg-timber-100 text-timber-400">
                No photo
              </div>
            )}
          </div>

          <div className="lg:col-span-5 lg:sticky lg:top-32 lg:self-start">
            <div className="flex items-start justify-between gap-4">
              <div>
                {typeLabel ? (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-clay">
                    {typeLabel}
                  </p>
                ) : null}
                <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3.25rem)] font-light leading-[1.02] tracking-tight text-timber-900">
                  {product.name}
                </h1>
              </div>
              <button
                type="button"
                onClick={() => toggle(product)}
                className="ff-icon-btn mt-1 shrink-0 border border-timber-200 bg-white text-timber-800 hover:border-timber-900"
                aria-label={liked ? 'Remove from wishlist' : 'Save to wishlist'}
              >
                <Heart className={`h-5 w-5 ${liked ? 'fill-clay text-clay' : ''}`} strokeWidth={1.5} />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span
                className={`text-2xl font-semibold tabular-nums ${
                  product.isSaleActive && product.salePrice != null ? 'text-clay' : 'text-timber-900'
                }`}
              >
                {formatMoney(price)}
              </span>
              {product.isSaleActive && product.salePrice != null && (
                <>
                  <span className="text-base tabular-nums text-timber-400 line-through">
                    {formatMoney(product.price)}
                  </span>
                  {Number(product.price) > 0 && (
                    <span className="rounded-full bg-clay px-2.5 py-1 text-[11px] font-bold text-white">
                      Save {Math.round((1 - Number(product.salePrice) / Number(product.price)) * 100)}%
                    </span>
                  )}
                </>
              )}
            </div>
            {product.reviewCount > 0 && (
              <a href="#reviews" className="mt-3 inline-flex items-center gap-2">
                <StarRating value={product.ratingAvg} readOnly size={16} />
                <span className="text-sm text-timber-500 underline-offset-4 hover:underline">
                  {product.ratingAvg} · {product.reviewCount} review
                  {product.reviewCount === 1 ? '' : 's'}
                </span>
              </a>
            )}

            {product.colors?.length > 0 && (
              <div className="mt-8 border-t border-timber-200/80 pt-6">
                <div className="mb-3 flex items-center gap-2 text-sm">
                  <span className="font-semibold text-timber-900">Colour</span>
                  <span className="text-timber-500">{color}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {product.colors.map((c) => {
                    const selected = color === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        title={c}
                        onClick={() => selectColor(c)}
                        className={`relative grid h-10 w-10 place-items-center rounded-full border transition ${
                          selected
                            ? 'border-timber-900 ring-2 ring-timber-900 ring-offset-2'
                            : 'border-timber-200 hover:border-timber-500'
                        }`}
                      >
                        <span
                          className="h-7 w-7 rounded-full border border-black/10"
                          style={colorSwatchStyle(c)}
                        />
                        <span className="sr-only">{c}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {product.sizes?.length > 0 && (
              <div className="mt-7">
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-timber-900">Size</span>
                    {size ? <span className="text-timber-500">{size}</span> : null}
                  </span>
                  <button
                    type="button"
                    className="text-[13px] font-medium text-timber-600 underline underline-offset-4 hover:text-timber-900"
                    onClick={() => setOpenSection('size')}
                  >
                    Size guide
                  </button>
                </div>
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
                        className={`min-w-[3.5rem] rounded-full border px-4 py-3 text-sm font-semibold transition ${
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
                <p className="mt-3 text-[13px] text-timber-500">{fitTip}</p>
              </div>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <div className="inline-flex items-center rounded-full border border-timber-200 bg-white">
                <button
                  type="button"
                  className="grid h-11 w-11 place-items-center rounded-full text-timber-700 hover:bg-timber-50"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" strokeWidth={1.5} />
                </button>
                <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums">{qty}</span>
                <button
                  type="button"
                  className="grid h-11 w-11 place-items-center rounded-full text-timber-700 hover:bg-timber-50 disabled:opacity-40"
                  onClick={() => setQty((q) => Math.min(available || 1, q + 1))}
                  disabled={qty >= available}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>

              <div className="text-[13px]">
                {productStock < 1 ? (
                  <span className="font-semibold text-red-600">Out of stock</span>
                ) : available < 1 && size ? (
                  <span className="font-semibold text-red-600">Size {size} is out of stock</span>
                ) : lowStock ? (
                  <span className="inline-flex items-center gap-2 font-semibold text-clay">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-clay" />
                    Only {available} left{size ? ` in ${size}` : ''}
                  </span>
                ) : available > 5 ? (
                  <span className="inline-flex items-center gap-2 text-timber-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    In stock, ready to ship
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-6 hidden gap-3 lg:flex">
              <button type="button" className="btn-outline btn-lg flex-1" onClick={add} disabled={!canAdd}>
                Add to bag
              </button>
              <button type="button" className="btn-wheat btn-lg flex-1" onClick={buyNow} disabled={!canAdd}>
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
                  Cash on delivery and card / wallet payment available at checkout. Free shipping
                  on orders over EGP 2,000.
                </p>
              </Accordion>
            </div>
          </div>
        </div>

        <section id="reviews" className="mt-20 scroll-mt-32 border-t border-timber-200/80 pt-14">
          <p className="ff-eyebrow">Reviews</p>
          <h2 className="ff-title mt-4">
            What customers <em>say</em>
          </h2>
          {product.reviewCount > 0 && (
            <div className="mt-6 flex items-center gap-3">
              <span className="font-display text-5xl font-light text-timber-900">
                {Number(product.ratingAvg || 0).toFixed(1)}
              </span>
              <div>
                <StarRating value={product.ratingAvg} readOnly size={16} />
                <p className="mt-1 text-sm text-timber-500">
                  Based on {product.reviewCount} review{product.reviewCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          )}
          <div className="mt-10 grid gap-12 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              {(product.reviews || []).length === 0 ? (
                <p className="rounded-2xl border border-dashed border-timber-300 p-8 text-center text-sm text-timber-500">
                  No reviews yet — be the first to share how it fits.
                </p>
              ) : (
                (product.reviews || []).map((r) => (
                  <article key={r.id} className="rounded-2xl bg-white p-6">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-timber-900">{r.name}</p>
                      <StarRating value={r.rating} readOnly size={14} />
                    </div>
                    <p className="mt-3 text-[15px] leading-relaxed text-timber-600">{r.comment}</p>
                  </article>
                ))
              )}
            </div>
            <form
              className="space-y-4 self-start rounded-2xl border border-timber-200/80 bg-white p-6 lg:col-span-5"
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
              <p className="font-display text-2xl font-light text-timber-900">Write a review</p>
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

      {related.length > 0 && (
        <section className="mt-20 bg-white">
          <div className="ff-container py-16 lg:py-24">
            <div className="mb-10">
              <p className="ff-eyebrow">Continue browsing</p>
              <h2 className="ff-title mt-4">
                You may <em>also like</em>
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-5 lg:grid-cols-4">
              {related.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 2} />
              ))}
            </div>
          </div>
        </section>
      )}

      <ProductLightbox
        open={lightboxOpen}
        photos={photos.filter(Boolean)}
        index={photoIdx}
        alt={product.name}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setActivePhoto}
      />

      <div className="ff-glass fixed inset-x-0 bottom-0 z-40 border-t border-timber-200/70 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <div className="me-1 min-w-0 shrink">
            <p className="truncate text-[11px] text-timber-500">{size ? `Size ${size}` : product.name}</p>
            <p className="text-sm font-semibold tabular-nums text-timber-900">{formatMoney(price)}</p>
          </div>
          <button
            type="button"
            className="btn-outline min-h-12 flex-1 px-3 text-[10.5px]"
            onClick={add}
            disabled={!canAdd}
          >
            Add to bag
          </button>
          <button
            type="button"
            className="btn-wheat min-h-12 flex-1 px-3 text-[10.5px]"
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
