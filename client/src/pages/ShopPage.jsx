import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import api from '../api/axios';
import ProductCard from '../components/store/ProductCard';
import { useCategories, subcategoriesForAudience } from '../context/CategoriesContext';
import { AUDIENCES, audienceLabel, colorSwatchStyle } from '../utils/helpers';
import EmptyState from '../components/ui/EmptyState';

const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

const PRICE_PRESETS = [
  { id: 'any', label: 'Any', min: null, max: null },
  { id: 'under-500', label: '< 500', min: null, max: 500 },
  { id: '500-1000', label: '500–1k', min: 500, max: 1000 },
  { id: 'over-1000', label: '1k+', min: 1000, max: null },
];

function parseBound(raw) {
  const trimmed = String(raw ?? '').trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function matchPricePreset(minPrice, maxPrice) {
  const preset = PRICE_PRESETS.find(
    (p) => p.min === minPrice && p.max === maxPrice
  );
  return preset?.id || 'custom';
}

function FilterSection({ title, children }) {
  return (
    <div className="border-b border-timber-100 py-4 last:border-b-0">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-timber-800">
        {title}
      </p>
      {children}
    </div>
  );
}

function FiltersPanel({
  embedded = false,
  onClose,
  categories,
  selectedCategory,
  selectedColors,
  selectedSizes,
  availableColors,
  availableSizes,
  minInput,
  maxInput,
  minPrice,
  maxPrice,
  onMinChange,
  onMaxChange,
  onPriceBlur,
  onApplyPricePreset,
  onSelectCategory,
  onToggleColor,
  onToggleSize,
  onClear,
}) {
  const activePreset = matchPricePreset(minPrice, maxPrice);
  const hasFilters =
    selectedCategory ||
    selectedColors.length > 0 ||
    selectedSizes.length > 0 ||
    minPrice != null ||
    maxPrice != null;

  return (
    <div
      className={`flex flex-col ${embedded ? 'h-full' : 'max-h-[calc(100vh-7rem)]'}`}
    >
      <div className="mb-4 shrink-0 flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-timber-400">
          Refine
        </p>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              onClear();
              onClose?.();
            }}
            className="text-[10px] font-semibold uppercase tracking-[0.16em] text-timber-500 underline-offset-4 hover:text-timber-900 hover:underline"
          >
            Reset
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
        {categories.length > 0 ? (
          <FilterSection title="Subcategory">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onSelectCategory('')}
                className={`px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] transition ${
                  !selectedCategory
                    ? 'bg-timber-900 text-white'
                    : 'bg-timber-50 text-timber-600 hover:bg-timber-100'
                }`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCategory(c.slug)}
                  className={`px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] transition ${
                    selectedCategory === c.slug
                      ? 'bg-timber-900 text-white'
                      : 'bg-timber-50 text-timber-600 hover:bg-timber-100'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </FilterSection>
        ) : null}

        {availableColors.length > 0 ? (
          <FilterSection title="Colour">
            <div className="flex flex-wrap gap-2">
              {availableColors.map((c) => {
                const active = selectedColors.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => onToggleColor(c)}
                    className={`group relative grid h-8 w-8 place-items-center rounded-full border transition ${
                      active
                        ? 'border-timber-900 ring-2 ring-timber-900 ring-offset-2'
                        : 'border-timber-200 hover:border-timber-500'
                    }`}
                  >
                    <span
                      className="h-5 w-5 rounded-full border border-black/10"
                      style={colorSwatchStyle(c)}
                    />
                    <span className="sr-only">{c}</span>
                  </button>
                );
              })}
            </div>
          </FilterSection>
        ) : null}

        {availableSizes.length > 0 ? (
          <FilterSection title="Size">
            <div className="grid grid-cols-4 gap-1.5">
              {availableSizes.map((s) => {
                const active = selectedSizes.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onToggleSize(s)}
                    className={`py-2 text-[11px] font-medium uppercase tracking-[0.08em] transition ${
                      active
                        ? 'bg-timber-900 text-white'
                        : 'bg-timber-50 text-timber-700 hover:bg-timber-100'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </FilterSection>
        ) : null}

        <FilterSection title="Price">
          <div className="flex flex-wrap gap-1.5">
            {PRICE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onApplyPricePreset(p.min, p.max)}
                className={`px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] transition ${
                  activePreset === p.id
                    ? 'bg-timber-900 text-white'
                    : 'bg-timber-50 text-timber-600 hover:bg-timber-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {activePreset === 'custom' ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Min"
                className="input py-2 text-xs"
                value={minInput}
                onChange={(e) => onMinChange(e.target.value)}
                onBlur={onPriceBlur}
              />
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Max"
                className="input py-2 text-xs"
                value={maxInput}
                onChange={(e) => onMaxChange(e.target.value)}
                onBlur={onPriceBlur}
              />
            </div>
          ) : null}
        </FilterSection>
      </div>

      {embedded ? (
        <button
          type="button"
          onClick={onClose}
          className="btn-wheat mt-4 w-full shrink-0 py-3 text-[11px] uppercase tracking-[0.2em]"
        >
          Show results
        </button>
      ) : null}
    </div>
  );
}

export default function ShopPage() {
  const [params, setParams] = useSearchParams();
  const { categories, treeByAudience } = useCategories();
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);

  const audience = params.get('audience') || '';
  const searchQuery = (params.get('q') || '').trim();
  const selectedCategory = params.get('category') || '';
  const selectedColors = useMemo(
    () => (params.get('colors') ? params.get('colors').split(',').filter(Boolean) : []),
    [params]
  );
  const selectedSizes = useMemo(
    () => (params.get('sizes') ? params.get('sizes').split(',').filter(Boolean) : []),
    [params]
  );
  const sort = params.get('sort') || 'recommended';
  const minPrice = parseBound(params.get('minPrice'));
  const maxPrice = parseBound(params.get('maxPrice'));
  const [minInput, setMinInput] = useState(params.get('minPrice') || '');
  const [maxInput, setMaxInput] = useState(params.get('maxPrice') || '');

  useEffect(() => {
    setMinInput(params.get('minPrice') || '');
    setMaxInput(params.get('maxPrice') || '');
  }, [params]);

  useEffect(() => {
    setLoading(true);
    setVisibleCount(24);
    const query = new URLSearchParams();
    if (audience) query.set('audience', audience);
    if (selectedCategory) query.set('category', selectedCategory);
    if (searchQuery) query.set('q', searchQuery);
    api
      .get(`/products?${query.toString()}`)
      .then((r) => setAllProducts(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAllProducts([]))
      .finally(() => setLoading(false));
  }, [audience, selectedCategory, searchQuery]);

  const audienceCategories = useMemo(
    () => subcategoriesForAudience(treeByAudience, audience || null),
    [audience, treeByAudience]
  );

  const patchParams = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) next.delete(k);
      else next.set(k, Array.isArray(v) ? v.join(',') : String(v));
    });
    setParams(next, { replace: true });
  };

  const toggleInList = (key, list, value) => {
    const set = new Set(list);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    patchParams({ [key]: [...set] });
  };

  const applyPriceToUrl = () => {
    patchParams({
      minPrice: minInput.trim() === '' ? null : minInput,
      maxPrice: maxInput.trim() === '' ? null : maxInput,
    });
  };

  const applyPricePreset = (min, max) => {
    setMinInput(min != null ? String(min) : '');
    setMaxInput(max != null ? String(max) : '');
    patchParams({
      minPrice: min != null ? String(min) : null,
      maxPrice: max != null ? String(max) : null,
    });
  };

  const clearFilters = () => {
    setMinInput('');
    setMaxInput('');
    const next = new URLSearchParams();
    if (audience) next.set('audience', audience);
    if (searchQuery) next.set('q', searchQuery);
    setParams(next, { replace: true });
  };

  const availableColors = useMemo(() => {
    const set = new Set();
    allProducts.forEach((p) => (p.colors || []).forEach((c) => set.add(c)));
    return [...set].sort();
  }, [allProducts]);

  const availableSizes = useMemo(() => {
    const set = new Set();
    allProducts.forEach((p) => (p.sizes || []).forEach((s) => set.add(s)));
    return [...set].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [allProducts]);

  const products = useMemo(() => {
    let list = [...allProducts];
    if (searchQuery) {
      const needle = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          String(p.name || '')
            .toLowerCase()
            .includes(needle) ||
          String(p.description || '')
            .toLowerCase()
            .includes(needle) ||
          String(p.type || '')
            .toLowerCase()
            .includes(needle)
      );
    }
    if (selectedColors.length) {
      list = list.filter((p) => (p.colors || []).some((c) => selectedColors.includes(c)));
    }
    if (selectedSizes.length) {
      list = list.filter((p) => (p.sizes || []).some((s) => selectedSizes.includes(s)));
    }
    if (minPrice != null) {
      list = list.filter((p) => {
        const price = p.isSaleActive && p.salePrice != null ? p.salePrice : p.price;
        return Number(price) >= minPrice;
      });
    }
    if (maxPrice != null) {
      list = list.filter((p) => {
        const price = p.isSaleActive && p.salePrice != null ? p.salePrice : p.price;
        return Number(price) <= maxPrice;
      });
    }
    if (sort === 'newest') {
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (sort === 'price_asc' || sort === 'price_desc') {
      const dir = sort === 'price_asc' ? 1 : -1;
      list.sort((a, b) => {
        const pa = a.isSaleActive && a.salePrice != null ? a.salePrice : a.price;
        const pb = b.isSaleActive && b.salePrice != null ? b.salePrice : b.price;
        return (Number(pa) - Number(pb)) * dir;
      });
    }
    return list;
  }, [allProducts, searchQuery, selectedColors, selectedSizes, minPrice, maxPrice, sort]);

  const filterProps = {
    categories: audienceCategories,
    selectedCategory,
    selectedColors,
    selectedSizes,
    availableColors,
    availableSizes,
    minInput,
    maxInput,
    minPrice,
    maxPrice,
    onMinChange: setMinInput,
    onMaxChange: setMaxInput,
    onPriceBlur: applyPriceToUrl,
    onApplyPricePreset: applyPricePreset,
    onSelectCategory: (slug) => patchParams({ category: slug || null }),
    onToggleColor: (c) => toggleInList('colors', selectedColors, c),
    onToggleSize: (s) => toggleInList('sizes', selectedSizes, s),
    onClear: clearFilters,
  };

  const heading = searchQuery
    ? `Results for “${searchQuery}”`
    : audience
      ? audienceLabel(audience)
      : 'The collection';

  const activeFilters = useMemo(() => {
    const chips = [];
    if (searchQuery) {
      chips.push({
        key: 'q',
        label: `Search: ${searchQuery}`,
        clear: () => patchParams({ q: null }),
      });
    }
    if (selectedCategory) {
      const cat = categories.find((c) => c.slug === selectedCategory);
      chips.push({ key: 'category', label: cat?.name || selectedCategory, clear: () => patchParams({ category: null }) });
    }
    selectedColors.forEach((c) =>
      chips.push({ key: `color-${c}`, label: c, clear: () => toggleInList('colors', selectedColors, c) })
    );
    selectedSizes.forEach((s) =>
      chips.push({ key: `size-${s}`, label: `Size ${s}`, clear: () => toggleInList('sizes', selectedSizes, s) })
    );
    if (minPrice != null) {
      chips.push({ key: 'min', label: `Min ${minPrice}`, clear: () => patchParams({ minPrice: null }) });
    }
    if (maxPrice != null) {
      chips.push({ key: 'max', label: `Max ${maxPrice}`, clear: () => patchParams({ maxPrice: null }) });
    }
    return chips;
  }, [searchQuery, selectedCategory, selectedColors, selectedSizes, minPrice, maxPrice, categories]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-white">
      <div className="border-b border-timber-100 bg-timber-50">
        <div className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <p className="brand-eyebrow">FutureFit</p>
          <h1 className="mt-4 font-display text-5xl font-medium tracking-tight text-timber-900 sm:text-6xl lg:text-7xl">
            {heading}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-timber-500">
            Classic cuts and refined staples — browse by department, colour, and size.
          </p>
          <div className="mt-10 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => patchParams({ audience: null, category: null })}
              className={`border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                !audience
                  ? 'border-timber-900 bg-timber-900 text-white'
                  : 'border-timber-200 bg-white text-timber-500 hover:border-timber-900 hover:text-timber-900'
              }`}
            >
              All
            </button>
            {AUDIENCES.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => patchParams({ audience: a.value, category: null })}
                className={`border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                  audience === a.value
                    ? 'border-timber-900 bg-timber-900 text-white'
                    : 'border-timber-200 bg-white text-timber-500 hover:border-timber-900 hover:text-timber-900'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-28 border border-timber-200 bg-white p-1 shadow-[0_12px_32px_-24px_rgba(9,9,11,0.35)]">
              <div className="border border-timber-100 bg-timber-50/80 px-4 py-1">
                <FiltersPanel {...filterProps} />
              </div>
            </div>
          </aside>

          <section>
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-timber-100 pb-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-timber-400">
                  Results
                </p>
                <p className="mt-1 text-sm font-medium text-timber-800">
                  {loading
                    ? 'Loading…'
                    : `${products.length} piece${products.length === 1 ? '' : 's'}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-outline btn-sm lg:hidden"
                  onClick={() => setMobileFilters(true)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Filters
                </button>
                <label className="relative inline-flex items-center">
                  <span className="sr-only">Sort</span>
                  <select
                    value={sort}
                    onChange={(e) => patchParams({ sort: e.target.value })}
                    className="input select-input min-w-[11rem] border-timber-900/15 py-2.5 pl-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-timber-800"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {activeFilters.length > 0 && (
              <div className="mb-6 flex flex-wrap items-center gap-2">
                {activeFilters.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={f.clear}
                    className="inline-flex items-center gap-1.5 border border-timber-200 bg-timber-50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-timber-700 transition hover:border-timber-900"
                  >
                    {f.label}
                    <X className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] font-medium uppercase tracking-[0.14em] text-timber-500 underline-offset-4 hover:text-timber-900 hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-2 xl:grid-cols-3 xl:gap-x-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-[3/4] bg-timber-100" />
                    <div className="mt-4 h-3 w-1/3 bg-timber-100" />
                    <div className="mt-2 h-4 w-2/3 bg-timber-100" />
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <EmptyState
                title="No pieces found"
                subtitle="Try clearing filters or another department."
                action={
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="btn-dark btn-sm text-[10px] uppercase tracking-[0.2em]"
                  >
                    Clear filters
                  </button>
                }
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-2 xl:grid-cols-3 xl:gap-x-6">
                  {products.slice(0, visibleCount).map((p, i) => (
                    <ProductCard key={p.id} product={p} priority={i < 2} />
                  ))}
                </div>
                {visibleCount < products.length ? (
                  <div className="mt-12 flex justify-center">
                    <button
                      type="button"
                      className="btn-outline px-8 text-[11px] uppercase tracking-[0.2em]"
                      onClick={() => setVisibleCount((n) => n + 24)}
                    >
                      Load more ({products.length - visibleCount} left)
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>

      {mobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-timber-900/40" onClick={() => setMobileFilters(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(100%,320px)] flex-col bg-white p-5 shadow-2xl">
            <div className="mb-2 flex shrink-0 items-center justify-between border-b border-timber-100 pb-4">
              <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-timber-800">
                Refine
              </span>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center hover:bg-timber-50"
                onClick={() => setMobileFilters(false)}
                aria-label="Close filters"
              >
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <FiltersPanel
                {...filterProps}
                embedded
                onClose={() => setMobileFilters(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
