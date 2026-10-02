import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import api from '../api/axios';
import ProductCard from '../components/store/ProductCard';
import { useCategories, subcategoriesForAudience } from '../context/CategoriesContext';
import {
  AUDIENCES,
  audienceLabel,
  colorSwatchStyle,
} from '../utils/helpers';
import EmptyState from '../components/ui/EmptyState';
import BrandLoader from '../components/ui/BrandLoader';

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

const DEPT_COPY = {
  men: 'Underwear, undershirts, and everyday essentials.',
  women: 'Pieces cut for ease, presence, and all-day wear.',
  kids: 'Soft staples sized for growing days.',
  all: 'Classic cuts and refined staples — browse by department, colour, and size.',
};

const LETTER_SIZE_RANK = {
  XXS: 0,
  XS: 1,
  S: 2,
  SMALL: 2,
  M: 3,
  MEDIUM: 3,
  L: 4,
  LARGE: 4,
  XL: 5,
  XLARGE: 5,
  '2XL': 6,
  XXL: 6,
  XXLARGE: 6,
  '3XL': 7,
  XXXL: 7,
  XXXLARGE: 7,
  '4XL': 8,
  XXXXL: 8,
};

function sizeSortKey(raw) {
  const s = String(raw || '').trim();
  const compact = s.toUpperCase().replace(/\s+/g, '');
  const age = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (age || /month|mo\b|year|yr\b/i.test(s)) {
    return [0, Number(age?.[1] || 0), Number(age?.[2] || 0), s];
  }
  if (/^\d+(\.\d+)?$/.test(compact)) {
    return [1, Number(compact), 0, s];
  }
  if (LETTER_SIZE_RANK[compact] != null) {
    return [2, LETTER_SIZE_RANK[compact], 0, s];
  }
  if (/one.?size|^os$/i.test(s)) return [3, 0, 0, s];
  return [4, 0, 0, s];
}

function sortSizes(sizes) {
  return [...sizes].sort((a, b) => {
    const ka = sizeSortKey(a);
    const kb = sizeSortKey(b);
    for (let i = 0; i < 3; i++) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return String(ka[3]).localeCompare(String(kb[3]), undefined, { numeric: true });
  });
}

function formatSizeLabel(raw) {
  let s = String(raw || '').trim();
  if (!s) return s;
  s = s.replace(/\s*MONTHS?\b/gi, ' mo');
  s = s.replace(/\s*YEARS?\b/gi, ' yr');
  s = s.replace(/^MEDIUM$/i, 'M');
  s = s.replace(/^LARGE$/i, 'L');
  s = s.replace(/^SMALL$/i, 'S');
  s = s.replace(/^X-?LARGE$/i, 'XL');
  s = s.replace(/^XX-?LARGE$/i, 'XXL');
  s = s.replace(/^XXX-?LARGE$/i, '3XL');
  s = s.replace(/^ONE\s*SIZE$/i, 'OS');
  return s;
}

function chipClass(active) {
  return `inline-flex min-h-9 items-center justify-center rounded-full border px-3.5 py-1.5 text-center text-[12px] font-medium transition ${
    active
      ? 'border-timber-900 bg-timber-900 text-white'
      : 'border-timber-200 bg-white text-timber-700 hover:border-timber-900 hover:text-timber-900'
  }`;
}

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
    <div className="border-b border-timber-200/70 py-5 last:border-b-0">
      <p className="mb-3 text-[13px] font-semibold text-timber-900">
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
      <div className="mb-2 shrink-0 flex items-center justify-between gap-3">
        <p className="font-display text-2xl font-light text-timber-900">Filter</p>
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
        {categories.length > 0 ? (
          <FilterSection title="Subcategory">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onSelectCategory('')}
                className={chipClass(!selectedCategory)}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCategory(c.slug)}
                  className={chipClass(selectedCategory === c.slug)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </FilterSection>
        ) : null}

        {availableColors.length > 0 ? (
          <FilterSection title="Colour">
            <div className="grid grid-cols-5 gap-x-2 gap-y-2.5">
              {availableColors.map((c) => {
                const active = selectedColors.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => onToggleColor(c)}
                    className={`mx-auto grid h-8 w-8 place-items-center rounded-full transition ${
                      active
                        ? 'outline outline-2 outline-offset-2 outline-timber-900'
                        : 'outline outline-1 outline-offset-1 outline-timber-200 hover:outline-timber-500'
                    }`}
                  >
                    <span
                      className="h-full w-full rounded-full border border-black/10"
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
            <div className="flex flex-wrap gap-1.5">
              {availableSizes.map((s) => {
                const active = selectedSizes.includes(s);
                const label = formatSizeLabel(s);
                return (
                  <button
                    key={s}
                    type="button"
                    title={s}
                    onClick={() => onToggleSize(s)}
                    className={`${chipClass(active)} max-w-full shrink-0`}
                  >
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </FilterSection>
        ) : null}

        <FilterSection title="Price">
          <div className="grid grid-cols-2 gap-1.5">
            {PRICE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onApplyPricePreset(p.min, p.max)}
                className={`${chipClass(activePreset === p.id)} w-full`}
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
          className="btn-wheat mt-4 w-full shrink-0"
        >
          Show results
        </button>
      ) : null}
    </div>
  );
}

export default function ShopPage() {
  const [params, setParams] = useSearchParams();
  const { categories, tree, treeByAudience } = useCategories();
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
    allProducts.forEach((p) => (p.sizes || []).forEach((s) => {
      const label = String(s || '').trim();
      if (label) set.add(label);
    }));
    return sortSizes([...set]);
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
    } else {
      // recommended — honor Shop Control order from the API (already sorted); keep stable
      const field =
        audience === 'men'
          ? 'shopSortMen'
          : audience === 'women'
            ? 'shopSortWomen'
            : audience === 'kids'
              ? 'shopSortKids'
              : 'shopSortAll';
      list.sort((a, b) => (Number(a[field] ?? 0) - Number(b[field] ?? 0)));
    }
    return list;
  }, [allProducts, searchQuery, selectedColors, selectedSizes, minPrice, maxPrice, sort, audience]);

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

  const activeDept = useMemo(() => {
    if (!audience) return null;
    return (
      tree.find((d) => (d.audience || d.slug) === audience) ||
      tree.find((d) => d.slug === audience) ||
      null
    );
  }, [tree, audience]);

  const heroStatement =
    (searchQuery && 'Showing matches across the catalog.') ||
    activeDept?.statement ||
    DEPT_COPY[audience] ||
    DEPT_COPY.all;

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
    <div className="min-h-[calc(100vh-4rem)] bg-bone">
      <section className="border-b border-timber-200/70">
        <div className="ff-container pb-8 pt-10 sm:pt-14 lg:pb-10">
          <nav className="text-[12px] text-timber-400" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-timber-800">Home</Link>
            <span className="mx-2">/</span>
            <Link to="/shop" className="hover:text-timber-800">Shop</Link>
            {audience ? (
              <>
                <span className="mx-2">/</span>
                <span className="text-timber-700">{audienceLabel(audience)}</span>
              </>
            ) : null}
          </nav>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1
                key={heading}
                className="ff-fade-up font-display text-[clamp(2.6rem,6vw,5rem)] font-light leading-[0.98] tracking-tight text-timber-900 text-balance"
              >
                {heading}
              </h1>
              <p key={heroStatement} className="ff-fade-up mt-4 max-w-md text-[15px] leading-relaxed text-timber-500">
                {heroStatement}
              </p>
            </div>

            <div
              className="inline-flex w-full gap-1 self-start rounded-full bg-timber-100 p-1 sm:w-auto lg:self-auto"
              role="tablist"
              aria-label="Department"
            >
              {[{ value: '', label: 'All' }, ...AUDIENCES].map((a) => {
                const active = (audience || '') === a.value;
                return (
                  <button
                    key={a.value || 'all'}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => patchParams({ audience: a.value || null, category: null })}
                    className={`flex-1 rounded-full px-5 py-2.5 text-[13px] font-semibold transition duration-300 sm:flex-none ${
                      active ? 'bg-white text-timber-900 shadow-sm' : 'text-timber-500 hover:text-timber-900'
                    }`}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          {audienceCategories.length > 0 && (
            <div className="ff-scroll-x -mx-5 mt-8 gap-2 px-5 sm:mx-0 sm:flex-wrap sm:px-0">
              <button
                type="button"
                data-active={!selectedCategory ? 'true' : 'false'}
                onClick={() => patchParams({ category: null })}
                className="ff-chip shrink-0"
              >
                All {audience ? audienceLabel(audience) : 'pieces'}
              </button>
              {audienceCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  data-active={selectedCategory === c.slug ? 'true' : 'false'}
                  onClick={() => patchParams({ category: c.slug })}
                  className="ff-chip shrink-0"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="ff-container py-8 lg:py-10">
        <div className="lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-12">
          <aside className="hidden lg:block">
            <div className="sticky top-32 rounded-2xl border border-timber-200/70 bg-white px-5 py-4">
              <FiltersPanel {...filterProps} />
            </div>
          </aside>

          <section>
            <div className="sticky top-[100px] z-30 -mx-5 mb-6 flex items-center justify-between gap-3 border-b border-timber-200/70 bg-bone/90 px-5 py-3 backdrop-blur-md sm:top-[112px] sm:mx-0 sm:px-0 lg:static lg:bg-transparent lg:py-0 lg:pb-5 lg:backdrop-blur-none">
              <p className="text-sm text-timber-500">
                {loading ? 'Loading…' : (
                  <>
                    <span className="font-semibold text-timber-900">{products.length}</span>{' '}
                    piece{products.length === 1 ? '' : 's'}
                  </>
                )}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-outline btn-sm lg:hidden"
                  onClick={() => setMobileFilters(true)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Filter
                  {activeFilters.length > 0 ? (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-clay px-1 text-[10px] text-white">
                      {activeFilters.length}
                    </span>
                  ) : null}
                </button>
                <label className="relative inline-flex items-center">
                  <span className="sr-only">Sort</span>
                  <select
                    value={sort}
                    onChange={(e) => patchParams({ sort: e.target.value })}
                    className="input select-input min-h-10 min-w-[10.5rem] !rounded-full py-2 pl-4 text-[13px] font-medium text-timber-800"
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
                  <button key={f.key} type="button" onClick={f.clear} className="ff-chip bg-timber-100">
                    {f.label}
                    <X className="h-3 w-3" strokeWidth={1.75} />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-2 text-[12px] font-semibold text-timber-500 underline-offset-4 hover:text-timber-900 hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}

            {loading ? (
              <div className="grid min-h-[40vh] place-items-center py-16">
                <BrandLoader size="lg" label="Loading pieces" />
              </div>
            ) : products.length === 0 ? (
              <EmptyState
                title="No pieces found"
                subtitle="Try clearing filters or another department."
                action={
                  <button type="button" onClick={clearFilters} className="btn-wheat btn-sm">
                    Clear filters
                  </button>
                }
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-5 xl:grid-cols-3">
                  {products.slice(0, visibleCount).map((p, i) => (
                    <ProductCard key={p.id} product={p} priority={i < 2} />
                  ))}
                </div>
                {visibleCount < products.length ? (
                  <div className="mx-auto mt-14 flex max-w-xs flex-col items-center gap-4 text-center">
                    <p className="text-[13px] text-timber-500">
                      Showing {Math.min(visibleCount, products.length)} of {products.length}
                    </p>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-timber-200">
                      <div
                        className="h-full rounded-full bg-timber-900 transition-[width] duration-500"
                        style={{ width: `${(Math.min(visibleCount, products.length) / products.length) * 100}%` }}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-outline w-full"
                      onClick={() => setVisibleCount((n) => n + 24)}
                    >
                      Load more
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>

      {mobileFilters && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div
            className="ff-fade absolute inset-0 bg-timber-950/45 backdrop-blur-[2px]"
            onClick={() => setMobileFilters(false)}
          />
          <div className="ff-sheet-in absolute inset-y-0 end-0 flex w-[min(100%,380px)] flex-col bg-bone p-5">
            <div className="mb-1 flex shrink-0 items-center justify-end">
              <button
                type="button"
                className="ff-icon-btn h-9 w-9 text-timber-700 hover:bg-timber-100"
                onClick={() => setMobileFilters(false)}
                aria-label="Close filters"
              >
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <FiltersPanel {...filterProps} embedded onClose={() => setMobileFilters(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
