import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import ProductCard from '../components/store/ProductCard';
import { getImageUrl, PRODUCT_TYPES, asArray } from '../utils/helpers';

export default function HomePage() {
  const [slides, setSlides] = useState([]);
  const [products, setProducts] = useState([]);
  const [index, setIndex] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    api
      .get('/slides')
      .then((r) => setSlides(asArray(r.data)))
      .catch(() => setSlides([]));
    api
      .get('/products?limit=8')
      .then((r) => setProducts(asArray(r.data)))
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, []);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 3500);
    return () => clearInterval(t);
  }, [slides.length]);

  const slide = slides[index];
  const fallbackTitle = 'Setting trends with every stitch.';
  const fallbackDescription =
    'Classic cuts. Modern presence. Apparel made to move with you — from Cairo streets to every occasion.';

  return (
    <div className="bg-white">
      <section className="relative min-h-[100svh] w-full overflow-hidden bg-timber-900">
        <div className="absolute inset-0">
          {slides.length > 0 ? (
            slides.map((s, i) => (
              <img
                key={s.id}
                src={getImageUrl(s.cloudinaryUrl)}
                alt={s.title}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-in-out ${
                  i === index ? 'opacity-55' : 'opacity-0'
                }`}
              />
            ))
          ) : (
            <div className="absolute inset-0 bg-timber-900" />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70" />
        <div className="relative mx-auto flex min-h-[100svh] max-w-7xl items-center justify-center px-5 text-center sm:px-8">
          <div className="max-w-3xl pb-24 pt-36 text-white sm:pt-40">
            <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-white/70">
              FutureFit
            </p>
            <div key={slide?.id || 'fallback'} className="hero-copy-fade">
              <h1 className="mt-5 font-display text-5xl font-medium leading-[0.95] tracking-tight sm:text-7xl md:text-8xl">
                {slide?.title || fallbackTitle}
              </h1>
              <p className="mx-auto mt-6 max-w-md text-balance text-base leading-relaxed text-white/75 sm:text-lg">
                {slide?.description || fallbackDescription}
              </p>
            </div>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link
                to="/shop"
                className="btn-wheat btn-lg text-[11px] uppercase tracking-[0.24em]"
              >
                Shop collection
              </Link>
              <Link
                to="/about"
                className="btn-outline btn-lg border-white/35 text-[11px] uppercase tracking-[0.24em] text-white hover:bg-white/10"
              >
                Our story
              </Link>
            </div>
          </div>
        </div>
        {slides.length > 1 && (
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
        )}
      </section>

      <section className="border-b border-timber-100">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-5 sm:px-6">
          {PRODUCT_TYPES.slice(0, 5).map((t) => (
            <Link
              key={t.value}
              to={`/shop?types=${t.value}`}
              className="text-[10px] font-medium uppercase tracking-[0.28em] text-timber-500 transition hover:text-timber-900"
            >
              {t.label}
            </Link>
          ))}
          <Link
            to="/shop"
            className="text-[10px] font-medium uppercase tracking-[0.28em] text-timber-900 underline underline-offset-8"
          >
            View all
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
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
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-timber-100" />
                <div className="mt-4 h-3 w-1/3 bg-timber-100" />
                <div className="mt-2 h-4 w-2/3 bg-timber-100" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-sm text-timber-500">No products yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
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

      <section className="border-t border-timber-100 bg-timber-50 py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 text-center sm:px-6 md:grid-cols-3">
          {[
            ['Tailored presence', 'Clean silhouettes that hold their shape'],
            ['Stitch by stitch', 'Details finished for lasting wear'],
            ['Cash on delivery', 'Pay when your order arrives'],
          ].map(([t, d]) => (
            <div key={t}>
              <h3 className="font-display text-2xl font-medium tracking-tight text-timber-900 sm:text-3xl">
                {t}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-timber-500">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        .hero-copy-fade {
          animation: heroCopyFade 900ms ease;
        }
        @keyframes heroCopyFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-copy-fade { animation: none; }
        }
      `}</style>
    </div>
  );
}
