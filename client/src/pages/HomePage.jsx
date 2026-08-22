import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import ProductCard from '../components/store/ProductCard';
import StarRating from '../components/store/StarRating';
import { getImageUrl, AUDIENCES, DEPT_IMAGES, asArray, FREE_SHIPPING_MIN, formatMoney } from '../utils/helpers';

const DEPT_COPY = {
  men: 'Underwear, undershirts, and everyday essentials.',
  women: 'Pieces cut for ease, presence, and all-day wear.',
  kids: 'Soft staples sized for growing days.',
};

export default function HomePage() {
  const [slides, setSlides] = useState([]);
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [deptPhotos, setDeptPhotos] = useState({});
  const [index, setIndex] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [email, setEmail] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/slides').then((r) => asArray(r.data)).catch(() => []),
      api.get('/products?limit=8').then((r) => asArray(r.data)).catch(() => []),
      api.get('/reviews?visible=true&limit=6').then((r) => asArray(r.data)).catch(() => []),
    ]).then(([slideData, productData, reviewData]) => {
      setSlides(slideData);
      setProducts(productData);
      setReviews(reviewData);
      const sortedSlides = [...slideData].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      );
      const productPhotoByAudience = {};
      productData.forEach((p) => {
        const key = p.audience || 'men';
        if (!productPhotoByAudience[key] && p.photos?.[0]) {
          productPhotoByAudience[key] = p.photos[0];
        }
      });
      const photos = {};
      AUDIENCES.forEach((a, i) => {
        photos[a.value] =
          sortedSlides[i]?.cloudinaryUrl ||
          DEPT_IMAGES[a.value] ||
          productPhotoByAudience[a.value] ||
          null;
      });
      setDeptPhotos(photos);
      setLoadingProducts(false);
    });
  }, []);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2) return;
    const next = slides[(index + 1) % slides.length];
    if (!next?.cloudinaryUrl) return;
    const img = new Image();
    img.src = getImageUrl(next.cloudinaryUrl, { width: 1400 });
  }, [index, slides]);

  const slide = slides[index];
  const fallbackTitle = 'Setting trends with every stitch.';
  const fallbackDescription =
    'Classic cuts. Modern presence. Apparel made to move with you — from Cairo streets to every occasion.';

  const go = (dir) => {
    if (!slides.length) return;
    setIndex((i) => (i + dir + slides.length) % slides.length);
  };

  return (
    <div className="bg-white">
      <section className="relative min-h-[72svh] w-full overflow-hidden bg-timber-900 sm:min-h-[85svh]">
        <div className="absolute inset-0">
          {slide?.cloudinaryUrl ? (
            <img
              key={slide.id}
              src={getImageUrl(slide.cloudinaryUrl, { width: 1400 })}
              alt={slide.title}
              width={1400}
              height={900}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out"
            />
          ) : (
            <div className="absolute inset-0 bg-timber-900" />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent" />
        <div className="relative mx-auto flex min-h-[72svh] max-w-7xl items-end px-5 pb-20 pt-32 sm:min-h-[85svh] sm:px-8 sm:pb-24 sm:pt-40">
          <div className="max-w-xl text-white">
            <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-white/70">
              FutureFit
            </p>
            <div key={slide?.id || 'fallback'} className="hero-copy-fade">
              <h1 className="mt-5 font-display text-4xl font-medium leading-[0.95] tracking-tight sm:text-7xl">
                {slide?.title || fallbackTitle}
              </h1>
              <p className="mt-6 max-w-md text-balance text-base leading-relaxed text-white/80 sm:text-lg">
                {slide?.description || fallbackDescription}
              </p>
            </div>
            <Link
              to="/shop"
              className="btn-wheat mt-10 inline-flex px-8 py-3.5 text-[11px] uppercase tracking-[0.24em]"
            >
              Shop collection
            </Link>
          </div>
        </div>
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center border border-white/30 text-white transition hover:bg-white hover:text-timber-900 sm:grid"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center border border-white/30 text-white transition hover:bg-white hover:text-timber-900 sm:grid"
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-px transition-all duration-500 ease-out ${
                    i === index ? 'w-10 bg-white' : 'w-5 bg-white/35'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="brand-eyebrow">Shop</p>
            <h2 className="mt-2 font-display text-4xl font-medium tracking-tight text-timber-900">
              Departments
            </h2>
          </div>
          <Link
            to="/shop"
            className="text-[10px] font-medium uppercase tracking-[0.24em] text-timber-500 underline-offset-8 hover:underline"
          >
            Shop all
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {AUDIENCES.map((a) => {
            const photo = deptPhotos[a.value];
            return (
              <Link
                key={a.value}
                to={`/shop?audience=${a.value}`}
                className="group relative min-h-[280px] overflow-hidden bg-timber-900 sm:min-h-[320px]"
              >
                {photo ? (
                  <img
                    src={getImageUrl(photo, { width: 800 })}
                    alt={`${a.label} collection`}
                    width={800}
                    height={1000}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-timber-800" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10 transition duration-300 group-hover:from-black/85" />
                <div className="relative flex h-full min-h-[280px] flex-col justify-end p-8 sm:min-h-[320px]">
                  <h3 className="font-display text-3xl font-medium sm:text-4xl">{a.label}</h3>
                  <p className="mt-2 max-w-xs text-sm text-white/75">{DEPT_COPY[a.value]}</p>
                  <span className="mt-6 text-[10px] uppercase tracking-[0.24em] underline underline-offset-8">
                    Shop {a.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="mb-12 flex items-end justify-between gap-4">
          <div>
            <p className="brand-eyebrow">New season</p>
            <h2 className="mt-2 font-display text-4xl font-medium tracking-tight text-timber-900 sm:text-5xl">
              Featured
            </h2>
            <p className="mt-2 text-sm text-timber-500">Pieces selected for fit and finish</p>
          </div>
          <Link
            to="/shop"
            className="shrink-0 text-[10px] font-medium uppercase tracking-[0.24em] text-timber-500 underline-offset-8 hover:text-timber-900 hover:underline"
          >
            View all
          </Link>
        </div>
        {loadingProducts ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-timber-100" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-sm text-timber-500">No products yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 2} />
            ))}
          </div>
        )}
      </section>

      <section className="bg-timber-900 py-24 text-white">
        <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
          <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-white/50">
            The house
          </p>
          <h2 className="mt-4 font-display text-4xl font-medium tracking-tight sm:text-5xl">
            Setting trends with every stitch
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-white/65 sm:text-base">
            Refined apparel designed for presence — clean lines, considered fabrics, and fits that
            hold their shape through the day.
          </p>
          <Link
            to="/about"
            className="mt-8 inline-flex border border-white/30 px-7 py-3 text-[11px] font-medium uppercase tracking-[0.24em] text-white transition hover:bg-white hover:text-timber-900"
          >
            Read our story
          </Link>
        </div>
      </section>

      {reviews.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <p className="brand-eyebrow">Reviews</p>
          <h2 className="mt-2 font-display text-4xl font-medium tracking-tight text-timber-900">
            From the fitting room
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {reviews.slice(0, 6).map((r) => (
              <article key={r.id} className="border border-timber-100 p-6">
                <StarRating value={r.rating} readOnly size={14} />
                <p className="mt-4 text-sm leading-relaxed text-timber-600 line-clamp-4">
                  {r.comment}
                </p>
                <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-timber-400">
                  {r.name}
                  {r.product?.name ? ` · ${r.product.name}` : ''}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="border-y border-timber-100 bg-timber-50 py-16">
        <div className="mx-auto max-w-xl px-4 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-timber-400">
            Newsletter
          </p>
          <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-timber-900">
            Access what others don't
          </h2>
          <form
            className="mt-6 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              const list = JSON.parse(localStorage.getItem('newsletterEmails') || '[]');
              if (email && !list.includes(email)) {
                list.push(email);
                localStorage.setItem('newsletterEmails', JSON.stringify(list));
              }
              toast.success('You\'re on the list');
              setEmail('');
            }}
          >
            <input
              type="email"
              required
              className="input flex-1"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="btn-wheat px-6">
              Subscribe
            </button>
          </form>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 text-center sm:px-6 md:grid-cols-3">
          {[
            ['Free shipping', `On orders over ${formatMoney(FREE_SHIPPING_MIN)}`],
            ['Cash on delivery', 'Pay when your order arrives'],
            ['14-day returns', 'Unworn items, easy exchange'],
          ].map(([t, d]) => (
            <div key={t}>
              <h3 className="font-display text-2xl font-medium tracking-tight text-timber-900">
                {t}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-timber-500">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
