import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { getImageUrl } from '../utils/helpers';

export default function AboutPage() {
  const [products, setProducts] = useState([]);
  const [slides, setSlides] = useState([]);

  useEffect(() => {
    api
      .get('/products')
      .then((r) => setProducts(Array.isArray(r.data) ? r.data : []))
      .catch(() => setProducts([]));
    api
      .get('/slides')
      .then((r) => setSlides(Array.isArray(r.data) ? r.data : []))
      .catch(() => setSlides([]));
  }, []);

  const gallery = useMemo(() => {
    const fromProducts = products
      .flatMap((p) => (p.photos || []).slice(0, 2).map((src) => ({ src, alt: p.name })))
      .filter((p) => p.src);
    const fromSlides = slides
      .map((s) => ({ src: s.cloudinaryUrl, alt: s.title || 'FutureFit' }))
      .filter((p) => p.src);
    const merged = [...fromSlides, ...fromProducts];
    const seen = new Set();
    return merged.filter((p) => {
      const url = getImageUrl(p.src);
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    }).slice(0, 9);
  }, [products, slides]);

  const hero = gallery[0];

  return (
    <div className="bg-white">
      <section className="relative min-h-[70svh] overflow-hidden bg-timber-900">
        {hero && (
          <img
            src={getImageUrl(hero.src)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-45"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30" />
        <div className="relative mx-auto flex min-h-[70svh] max-w-7xl items-end px-5 pb-16 pt-28 sm:px-8 sm:pb-20">
          <div className="max-w-2xl text-white">
            <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-white/65">
              About FutureFit
            </p>
            <h1 className="mt-4 font-display text-5xl font-medium tracking-tight sm:text-7xl">
              Setting trends with every stitch.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/75 sm:text-lg">
              FutureFit is an Egyptian apparel house built on clean lines, confident fits, and
              pieces that earn a place in your everyday rotation.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        <h2 className="font-display text-4xl font-medium tracking-tight text-timber-900 sm:text-5xl">
          Our story
        </h2>
        <div className="mt-8 space-y-5 text-base leading-relaxed text-timber-600 sm:text-lg">
          <p>
            We started FutureFit with a clear brief: classic silhouettes, modern attitude, and
            craftsmanship you can feel in the fabric and the finish — no noise, just presence.
          </p>
          <p>
            Every piece is chosen for proportion, comfort, and lasting wear. We ship across Egypt
            with cash on delivery, InstaPay, and Vodafone Cash so checkout stays simple.
          </p>
        </div>
      </section>

      {gallery.length > 0 && (
        <section className="pb-6 sm:pb-10">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <p className="brand-eyebrow">Gallery</p>
            <h2 className="mt-2 font-display text-4xl font-medium tracking-tight text-timber-900">
              In the atelier
            </h2>
            <p className="mt-2 text-sm text-timber-500">A look at the collection in motion.</p>
          </div>
          <div className="mt-8 columns-2 gap-2 px-2 sm:columns-3 sm:gap-3 sm:px-4 md:px-6">
            {gallery.map((shot, i) => (
              <figure
                key={`${shot.src}-${i}`}
                className="mb-2 break-inside-avoid overflow-hidden bg-timber-100 sm:mb-3"
              >
                <img
                  src={getImageUrl(shot.src)}
                  alt={shot.alt}
                  className="w-full object-cover transition duration-700 hover:scale-[1.02]"
                  loading="lazy"
                />
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="border-y border-timber-100 bg-timber-50 py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 md:grid-cols-3">
          {[
            ['Fabric first', 'Materials selected for drape, comfort, and lasting shape.'],
            ['Egypt-ready delivery', 'COD, InstaPay, and Vodafone Cash — confirmed within 12 hours.'],
            ['Easy returns', 'Unworn items can be returned within 14 days.'],
          ].map(([title, body]) => (
            <div key={title}>
              <h3 className="font-display text-2xl font-medium tracking-tight text-timber-900">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-timber-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 text-center sm:px-8 sm:py-24">
        <h2 className="font-display text-4xl font-medium tracking-tight text-timber-900 sm:text-5xl">
          Ready when you are
        </h2>
        <p className="mx-auto mt-4 max-w-md text-timber-500">
          Browse the full collection or get in touch — we’re here to help you find the right fit.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            to="/shop"
            className="btn-wheat min-h-12 px-7 py-3 text-[11px] uppercase tracking-[0.22em]"
          >
            Shop collection
          </Link>
          <Link
            to="/contact"
            className="btn-outline min-h-12 px-7 py-3 text-[11px] uppercase tracking-[0.22em]"
          >
            Contact us
          </Link>
        </div>
      </section>
    </div>
  );
}
