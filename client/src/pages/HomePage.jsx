import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CreditCard,
  MessageCircle,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import BrandLoader from '../components/ui/BrandLoader';
import ProductCard from '../components/store/ProductCard';
import StarRating from '../components/store/StarRating';
import Reveal from '../components/store/Reveal';
import SectionHeading from '../components/store/SectionHeading';
import { useCategories } from '../context/CategoriesContext';
import {
  getImageUrl,
  getImageSrcSet,
  AUDIENCES,
  DEPT_IMAGES,
  asArray,
  FREE_SHIPPING_MIN,
  formatMoney,
  STORE_WHATSAPP_URL,
} from '../utils/helpers';

const FALLBACK_COPY = {
  men: 'Underwear, undershirts, and everyday essentials.',
  women: 'Pieces cut for ease, presence, and all-day wear.',
  kids: 'Soft staples sized for growing days.',
};

const SLIDE_MS = 6500;

const TRUST_ITEMS = [
  `Free shipping over ${formatMoney(FREE_SHIPPING_MIN)}`,
  'Cash on delivery',
  'Card & wallet via Paymob',
  '14-day returns',
  'Delivered across Egypt',
];

const SERVICES = [
  {
    icon: Truck,
    title: 'Free delivery',
    body: `On every order over ${formatMoney(FREE_SHIPPING_MIN)}, shipped in 2–3 business days.`,
  },
  {
    icon: Banknote,
    title: 'Pay on delivery',
    body: 'Cash on delivery anywhere in Egypt — pay when it reaches your door.',
  },
  {
    icon: CreditCard,
    title: 'Card or wallet',
    body: 'Prefer to prepay? Checkout securely by card or mobile wallet with Paymob.',
  },
  {
    icon: RefreshCw,
    title: 'Easy returns',
    body: '14 days to return or exchange unworn pieces.',
    to: '/returns',
  },
  {
    icon: MessageCircle,
    title: 'Real help',
    body: 'Sizing doubts? Message us on WhatsApp and a real person replies.',
    href: STORE_WHATSAPP_URL,
  },
];

function Hero({ slides }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(null);
  const count = slides.length;
  const slide = slides[index];

  useEffect(() => {
    if (count < 2 || paused) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => clearTimeout(t);
  }, [count, paused, index]);

  useEffect(() => {
    if (count < 2) return;
    const next = slides[(index + 1) % count];
    if (!next?.cloudinaryUrl) return;
    const img = new Image();
    img.src = getImageUrl(next.cloudinaryUrl, { width: 1400 });
  }, [index, slides, count]);

  const go = (dir) => count && setIndex((i) => (i + dir + count) % count);

  return (
    <section
      className="home-hero relative w-full overflow-hidden bg-timber-900 text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchStartX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start == null || count < 2) return;
        const dx = (e.changedTouches[0]?.clientX ?? start) - start;
        if (Math.abs(dx) >= 48) go(dx < 0 ? 1 : -1);
      }}
      aria-roledescription="carousel"
      aria-label="Homepage slideshow"
    >
      <div className="absolute inset-0">
        {slide?.cloudinaryUrl ? (
          <img
            key={slide.id}
            src={getImageUrl(slide.cloudinaryUrl, { width: 1280 })}
            srcSet={getImageSrcSet(slide.cloudinaryUrl, [640, 960, 1280, 1600, 2000])}
            alt={slide.title || 'FutureFit'}
            width={1600}
            height={900}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            sizes="100vw"
            className="ff-kenburns absolute inset-0 h-full w-full object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(161,161,170,0.25),transparent_55%),linear-gradient(160deg,#27272a_0%,#18181b_60%,#09090b_100%)]" />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/30" />

      <div className="ff-container relative flex h-full flex-col justify-end pb-24 pt-32 sm:pb-28">
        <div key={slide?.id || 'fallback'} className="max-w-3xl">
          <p className="ff-fade-up text-[11px] font-semibold uppercase tracking-[0.36em] text-blush">
            FutureFit · From Cairo
          </p>
          <h1
            className="ff-fade-up mt-5 font-display text-[clamp(2.6rem,8vw,6.5rem)] font-light leading-[0.95] tracking-[-0.03em] text-balance"
            style={{ animationDelay: '80ms' }}
          >
            {slide?.title || (
              <>
                Setting trends with <em className="italic text-blush">every stitch.</em>
              </>
            )}
          </h1>
          <p
            className="ff-fade-up mt-5 max-w-lg text-[15px] leading-relaxed text-white/80 sm:text-lg"
            style={{ animationDelay: '160ms' }}
          >
            {slide?.description ||
              'Classic cuts. Modern presence. Essentials made to move with you — from Cairo streets to every occasion.'}
          </p>
        </div>
        <div className="ff-fade-up mt-8 flex flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
          <Link to="/shop" className="btn-lg btn bg-white text-timber-900 hover:bg-blush">
            Shop all
          </Link>
        </div>
      </div>

      {count > 1 && (
        <div className="ff-container absolute inset-x-0 bottom-6 flex items-center gap-4 sm:bottom-8">
          <span className="text-[11px] font-semibold tabular-nums tracking-[0.2em] text-white/80">
            {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
          </span>
          <div className="flex flex-1 gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Slide ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => setIndex(i)}
                className="group relative h-6 flex-1 touch-manipulation"
              >
                <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 overflow-hidden rounded-full bg-white/25">
                  {i < index && <span className="absolute inset-0 bg-white" />}
                  {i === index && (
                    <span
                      key={`${s.id}-${paused}`}
                      className="ff-progress absolute inset-0 bg-white"
                      style={{
                        animationDuration: `${SLIDE_MS}ms`,
                        animationPlayState: paused ? 'paused' : 'running',
                      }}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
          <div className="hidden gap-2 sm:flex">
            <button
              type="button"
              onClick={() => go(-1)}
              className="ff-icon-btn border border-white/30 text-white hover:bg-white hover:text-timber-900"
              aria-label="Previous slide"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="ff-icon-btn border border-white/30 text-white hover:bg-white hover:text-timber-900"
              aria-label="Next slide"
            >
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function TrustMarquee() {
  const row = [...TRUST_ITEMS, ...TRUST_ITEMS];
  return (
    <div className="overflow-hidden border-b border-timber-200/70 bg-sand py-4" aria-label="Store benefits">
      <div className="ff-marquee items-center">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
            {row.map((t, i) => (
              <span key={`${copy}-${i}`} className="flex items-center">
                <span
                  className={`px-6 text-[13px] font-medium sm:px-8 sm:text-sm ${
                    i % 2 ? 'font-display italic text-clay' : 'text-timber-800'
                  }`}
                >
                  {t}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-nude" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductRail({ products }) {
  const railRef = useRef(null);
  const scrollBy = (dir) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.firstElementChild;
    rail.scrollBy({ left: dir * ((card?.offsetWidth || 300) + 20) * 2, behavior: 'smooth' });
  };
  return (
    <div className="relative">
      <div
        ref={railRef}
        className="ff-scroll-x -mx-5 gap-4 scroll-px-5 px-5 pb-2 sm:-mx-8 sm:gap-5 sm:scroll-px-8 sm:px-8 lg:-mx-12 lg:scroll-px-12 lg:px-12"
      >
        {products.map((p, i) => (
          <div key={p.id} className="w-[46vw] shrink-0 snap-start sm:w-[30vw] lg:w-[23%]">
            <ProductCard product={p} priority={i < 2} />
          </div>
        ))}
      </div>
      {products.length > 4 && (
        <div className="mt-8 hidden justify-end gap-2 sm:flex">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Previous"
            className="ff-icon-btn border border-timber-900/20 text-timber-900 hover:border-timber-900 hover:bg-timber-900 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Next"
            className="ff-icon-btn border border-timber-900/20 text-timber-900 hover:border-timber-900 hover:bg-timber-900 hover:text-white"
          >
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const { tree } = useCategories();
  const [slides, setSlides] = useState([]);
  const [products, setProducts] = useState([]);
  const [packs, setPacks] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [fallbackPhotos, setFallbackPhotos] = useState({});
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [bestFilter, setBestFilter] = useState('all');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const departments = (tree?.length
    ? tree
    : AUDIENCES.map((a) => ({
        id: a.value,
        slug: a.value,
        audience: a.value,
        name: a.label,
        statement: FALLBACK_COPY[a.value],
        imageUrl: null,
        sortOrder: 0,
      }))
  )
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  useEffect(() => {
    Promise.all([
      api.get('/slides').then((r) => asArray(r.data)).catch(() => []),
      api.get('/homepage').then((r) => r.data || {}).catch(() => ({})),
      api.get('/reviews?visible=true&limit=6').then((r) => asArray(r.data)).catch(() => []),
    ]).then(([slideData, homeData, reviewData]) => {
      const sortedSlides = [...slideData].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      setSlides(sortedSlides);
      setProducts(asArray(homeData.bestSellers));
      setPacks(asArray(homeData.packs));
      setReviews(reviewData);
      const productPhotoByAudience = {};
      asArray(homeData.bestSellers).forEach((p) => {
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
      setFallbackPhotos(photos);
      setLoadingProducts(false);
    });
  }, []);

  const bestAudiences = useMemo(() => {
    const set = new Set(products.map((p) => p.audience).filter(Boolean));
    return AUDIENCES.filter((a) => set.has(a.value));
  }, [products]);

  const visibleBest = useMemo(
    () => (bestFilter === 'all' ? products : products.filter((p) => p.audience === bestFilter)),
    [products, bestFilter]
  );

  const ratingSummary = useMemo(() => {
    if (!reviews.length) return null;
    const avg = reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length;
    return { avg: Math.round(avg * 10) / 10, count: reviews.length };
  }, [reviews]);

  const editorialImage =
    slides[1]?.cloudinaryUrl || slides[0]?.cloudinaryUrl || fallbackPhotos.men || DEPT_IMAGES.men;

  const subscribe = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post('/newsletter', { email, source: 'home' });
      toast.success('You’re on the list — thanks for signing up');
      setEmail('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-bone">
      <Hero slides={slides} />
      <TrustMarquee />

      {/* Departments */}
      <section className="ff-section">
        <div className="ff-container">
          <SectionHeading
            eyebrow="Shop by department"
            title="The best way to shop"
            titleEm="the essentials you love."
            link="/shop"
            linkLabel="Shop all"
          />
          <div className="ff-scroll-x -mx-5 mt-12 gap-4 scroll-px-5 px-5 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0">
            {departments.map((dept, i) => {
              const key = dept.audience || dept.slug;
              const photo = dept.imageUrl || fallbackPhotos[key] || DEPT_IMAGES[key] || null;
              const statement = dept.statement || FALLBACK_COPY[key] || '';
              const href = ['men', 'women', 'kids'].includes(dept.slug)
                ? `/shop?audience=${dept.slug}`
                : `/shop?category=${dept.slug}`;
              return (
                <Reveal key={dept.id} delay={i * 90} className="w-[72vw] shrink-0 snap-start sm:w-auto">
                  <Link to={href} className="group block">
                    <div className="relative aspect-square overflow-hidden rounded-3xl bg-timber-200">
                      {photo ? (
                        <img
                          src={getImageUrl(photo, { width: 640, aspect: '1:1' })}
                          srcSet={getImageSrcSet(photo, [480, 640, 800, 1000], { aspect: '1:1' })}
                          alt={`${dept.name} collection`}
                          width={800}
                          height={800}
                          loading="lazy"
                          decoding="async"
                          sizes="(min-width: 640px) 33vw, 72vw"
                          className="ff-img-zoom absolute inset-0 h-full w-full object-cover"
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                      <span className="absolute bottom-5 end-5 grid h-12 w-12 place-items-center rounded-full bg-white/90 text-timber-900 backdrop-blur transition duration-500 group-hover:bg-timber-900 group-hover:text-white">
                        <ArrowUpRight className="h-5 w-5" strokeWidth={1.5} />
                      </span>
                    </div>
                    <div className="mt-5 px-1">
                      <h3 className="font-display text-[1.9rem] font-light leading-none text-timber-900">
                        {dept.name}
                      </h3>
                      {statement ? (
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-timber-500">{statement}</p>
                      ) : null}
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Best sellers */}
      <section className="ff-section bg-white">
        <div className="ff-container">
          <SectionHeading
            eyebrow="Top picks"
            title="Best"
            titleEm="sellers"
            body="Customer favourites, selected by the house."
            link="/shop"
          />
          {bestAudiences.length > 1 && (
            <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Filter best sellers">
              {[{ value: 'all', label: 'All' }, ...bestAudiences].map((a) => (
                <button
                  key={a.value}
                  type="button"
                  role="tab"
                  aria-selected={bestFilter === a.value}
                  data-active={bestFilter === a.value ? 'true' : 'false'}
                  onClick={() => setBestFilter(a.value)}
                  className="ff-chip"
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
          <div className="mt-10">
            {loadingProducts ? (
              <div className="grid min-h-[20rem] place-items-center py-12">
                <BrandLoader size="md" label="Loading pieces" />
              </div>
            ) : visibleBest.length === 0 ? (
              <p className="text-sm text-timber-500">Best sellers coming soon.</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-5 lg:grid-cols-4">
                {visibleBest.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 2} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Editorial — fabric & fit */}
      <section className="ff-section">
        <div className="ff-container grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-timber-200">
              {editorialImage ? (
                <img
                  src={getImageUrl(editorialImage, { width: 900, aspect: '4:5' })}
                  srcSet={getImageSrcSet(editorialImage, [600, 900, 1200], { aspect: '4:5' })}
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="absolute -bottom-6 end-6 rounded-2xl bg-white px-5 py-4 shadow-[0_24px_50px_-28px_rgba(9,9,11,0.45)] sm:end-10">
              <p className="font-display text-3xl font-light text-timber-900">All-day</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-clay">comfort, built in</p>
            </div>
          </Reveal>
          <div>
            <SectionHeading
              eyebrow="Fabric & fit"
              title="Soft hand. Clean lines."
              titleEm="All-day hold."
              body="Considered fabrics and precise cuts — underwear and essentials made to stay comfortable from morning through late."
            />
            <Reveal delay={120} className="mt-10 divide-y divide-timber-200/80 border-y border-timber-200/80">
              {[
                ['01', 'Considered fabrics', 'Soft against the skin for comfortable, all-day wear.'],
                ['02', 'Precise cuts', 'Clean lines and waistbands that hold without digging in.'],
                ['03', 'Made to keep shape', 'Fits that hold their shape from morning through late.'],
              ].map(([n, t, d]) => (
                <div key={n} className="flex gap-6 py-5">
                  <span className="font-display text-xl italic text-clay">{n}</span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-timber-900">{t}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-timber-500">{d}</p>
                  </div>
                </div>
              ))}
            </Reveal>
            <Reveal delay={200} className="mt-10 flex flex-wrap gap-4">
              <Link to="/shop" className="btn-wheat">
                Shop the essentials
              </Link>
              <Link to="/about" className="ff-link self-center">
                Our story
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Packs */}
      {packs.length > 0 && (
        <section className="ff-section ff-grain overflow-hidden bg-blush/50">
          <div className="ff-container">
            <SectionHeading
              eyebrow="Keep exploring"
              title="Packs &"
              titleEm="bundles"
              body="Stock up on the pieces you wear most."
              link="/shop"
              linkLabel="Shop all"
            />
            <div className="mt-12">
              <ProductRail products={packs} />
            </div>
          </div>
        </section>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="ff-section bg-white">
          <div className="ff-container">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
              <div>
                <SectionHeading eyebrow="Reviews" title="From the" titleEm="fitting room" />
                {ratingSummary && (
                  <Reveal delay={120} className="mt-8 flex items-end gap-4">
                    <span className="font-display text-7xl font-light leading-none text-timber-900">
                      {ratingSummary.avg.toFixed(1)}
                    </span>
                    <div className="pb-2">
                      <StarRating value={ratingSummary.avg} readOnly size={16} />
                      <p className="mt-1 text-sm text-timber-500">
                        Average from recent customer reviews
                      </p>
                    </div>
                  </Reveal>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {reviews.slice(0, 4).map((r, i) => (
                  <Reveal
                    key={r.id}
                    delay={i * 80}
                    as="article"
                    className="flex flex-col rounded-2xl border border-timber-200/80 bg-bone p-6"
                  >
                    <StarRating value={r.rating} readOnly size={14} />
                    <p className="mt-4 flex-1 font-display text-lg font-light leading-snug text-timber-800 line-clamp-5">
                      “{r.comment}”
                    </p>
                    <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-timber-400">
                      {r.name}
                      {r.product?.name ? <span className="text-clay"> · {r.product.name}</span> : null}
                    </p>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Services */}
      <section className="ff-section">
        <div className="ff-container">
          <SectionHeading
            eyebrow="Why FutureFit"
            title="Shopping made"
            titleEm="effortless."
            align="center"
          />
          <div className="ff-scroll-x -mx-5 mt-12 gap-4 scroll-px-5 px-5 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-5">
            {SERVICES.map((s, i) => {
              const Icon = s.icon;
              const inner = (
                <>
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-blush text-clay">
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                  <h3 className="mt-6 text-[15px] font-semibold text-timber-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-timber-500">{s.body}</p>
                </>
              );
              const cls =
                'block h-full rounded-2xl border border-timber-200/80 bg-white p-6 transition duration-500 hover:-translate-y-1 hover:shadow-[0_24px_50px_-30px_rgba(9,9,11,0.35)]';
              return (
                <Reveal key={s.title} delay={i * 70} className="w-[70vw] shrink-0 snap-start sm:w-auto">
                  {s.to ? (
                    <Link to={s.to} className={cls}>
                      {inner}
                    </Link>
                  ) : s.href ? (
                    <a href={s.href} target="_blank" rel="noreferrer" className={cls}>
                      {inner}
                    </a>
                  ) : (
                    <div className={cls}>{inner}</div>
                  )}
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="relative overflow-hidden bg-timber-900 text-bone">
        <div
          className="pointer-events-none absolute -bottom-[0.18em] left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-display text-[clamp(6rem,22vw,20rem)] font-light leading-none tracking-tight text-white/[0.04]"
          aria-hidden
        >
          FutureFit
        </div>
        <div className="ff-container relative grid gap-10 py-20 sm:py-28 lg:grid-cols-2 lg:items-end">
          <div>
            <p className="ff-eyebrow !text-blush">Newsletter</p>
            <h2 className="mt-4 font-display text-[clamp(2.4rem,5vw,4.5rem)] font-light leading-[1] tracking-tight">
              First to know. <em className="italic text-blush">First to wear.</em>
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-bone/65">
              New drops and restocks — straight to your inbox. No spam, ever.
            </p>
          </div>
          <form onSubmit={subscribe} className="flex w-full flex-col gap-3 sm:flex-row lg:justify-self-end lg:max-w-lg">
            <input
              type="email"
              required
              className="min-h-[3.25rem] flex-1 rounded-full border border-white/20 bg-white/5 px-6 text-[15px] text-white outline-none transition placeholder:text-white/40 focus:border-white/60"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email address"
            />
            <button
              type="submit"
              disabled={sending}
              className="btn min-h-[3.25rem] rounded-full bg-bone px-8 text-timber-900 hover:bg-blush"
            >
              {sending ? 'Saving…' : 'Subscribe'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
