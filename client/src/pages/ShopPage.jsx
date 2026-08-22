import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import api from '../api/axios';
import ProductCard from '../components/store/ProductCard';
import { useCategories } from '../context/CategoriesContext';
import { AUDIENCES, audienceLabel, colorSwatch } from '../utils/helpers';
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

function FilterSection({ title, hint, open, onToggle, children }) {
  return (
    <div className="border-b border-timber-100 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 py-3.5 text-left"
      >
        <div className="min-w-0">
          <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-timber-800">
            {title}
          </span>
          {!open && hint ? (
            <p className="mt-0.5 truncate text-[11px] text-timber-400">{hint}</p>
          ) : null}
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-timber-400 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.5}
        />
      </button>
      {open ? <div className="pb-4">{children}</div> : null}
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

  const [open, setOpen] = useState(() => ({
    type: Boolean(selectedCategory),
    color: selectedColors.length > 0,
    size: selectedSizes.length > 0,
    price: minPrice != null || maxPrice != null,
  }));

  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const typeHint = selectedCategory
    ? categories.find((c) => c.slug === selectedCategory)?.name || selectedCategory
    : 'All types';
  const colorHint = selectedColors.length
    ? selectedColors.length === 1
      ? selectedColors[0]
      : `${selectedColors.length} selected`
    : 'Any';
  const sizeHint = selectedSizes.length
    ? selectedSizes.length === 1
      ? selectedSizes[0]
      : selectedSizes.join(', ')
    : 'Any';
  const priceHint =
    activePreset !== 'custom' && activePreset !== 'any'
      ? PRICE_PRESETS.find((p) => p.id === activePreset)?.label
      : minPrice != null || maxPrice != null
        ? [minPrice != null ? `≥ ${minPrice}` : null, maxPrice != null ? `≤ ${maxPrice}` : null]
            .filter(Boolean)
            .join(' · ')
        : 'Any';

  return (
    <div
      className={`flex flex-col ${embedded ? 'h-full' : 'max-h-[calc(100vh-7rem)]'}`}
    >
      <div className="mb-4 shrink-0 flex items-center justify-between gap-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-timber-400">
          Refine
        </p>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              onClear();
              onClose?.();
            }}
            className="text-[10px] font-medium uppercase tracking-[0.16em] text-timber-500 underline-offset-4 hover:text-timber-900 hover:underline"
          >
            Reset
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
        {categories.length > 0 ? (
          <FilterSection
            title="Type"
            hint={typeHint}
            open={open.type}
            onToggle={() => toggle('type')}
          >
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
          <FilterSection
            title="Colour"
            hint={colorHint}
            open={open.color}
            onToggle={() => toggle('color')}
          >
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
                      style={{ backgroundColor: colorSwatch(c) }}
                    />
                    <span className="sr-only">{c}</span>
                  </button>
                );
              })}
            </div>
          </FilterSection>
        ) : null}

        {availableSizes.length > 0 ? (
          <FilterSection
            title="Size"
            hint={sizeHint}
            open={open.size}
            onToggle={() => toggle('size')}
          >
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

        <FilterSection
          title="Price"
          hint={priceHint}
          open={open.price}
          onToggle={() => toggle('price')}
        >
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
  const { categories } = useCategories();
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileFilters, setMobileFilters] = useState(false);

  const audience = params.get('audience') || '';
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
    const query = new URLSearchParams();
    if (audience) query.set('audience', audience);
    if (selectedCategory) query.set('category', selectedCategory);
    api
      .get(`/products?${query.toString()}`)
      .then((r) => setAllProducts(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAllProducts([]))
      .finally(() => setLoading(false));
  }, [audience, selectedCategory]);

  const audienceCategories = useMemo(
    () => (audience ? categories.filter((c) => c.audience === audience) : categories),
    [categories, audience]
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
  }, [allProducts, selectedColors, selectedSizes, minPrice, maxPrice, sort]);

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

  const heading = audience ? audienceLabel(audience) : 'The collection';

  const activeFilters = useMemo(() => {
    const chips = [];
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
  }, [selectedCategory, selectedColors, selectedSizes, minPrice, maxPrice, categories]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-white">
      <div className="border-b border-timber-100 bg-timber-50">
        <div className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-timber-400">
            FutureFit
          </p>
          <h1 className="mt-3 font-display text-5xl font-medium tracking-tight text-timber-900 sm:text-6xl">
            {heading}
          </h1>
          <p className="mt-3 max-w-md text-sm text-timber-500">
            Classic cuts and refined staples — browse by department, colour, and size.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            <button
              type="button"
              onClick={() => patchParams({ audience: null, category: null })}
              className={`text-[11px] font-medium uppercase tracking-[0.24em] transition ${
                !audience
                  ? 'text-timber-900 underline underline-offset-8'
                  : 'text-timber-400 hover:text-timber-800'
              }`}
            >
              All
            </button>
            {AUDIENCES.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => patchParams({ audience: a.value, category: null })}
                className={`text-[11px] font-medium uppercase tracking-[0.24em] transition ${
                  audience === a.value
                    ? 'text-timber-900 underline underline-offset-8'
                    : 'text-timber-400 hover:text-timber-800'
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
            <div className="sticky top-28 rounded-sm border border-timber-100 bg-timber-50/50 p-4">
              <FiltersPanel {...filterProps} />
            </div>
          </aside>

          <section>
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-timber-100 pb-5">
              <p className="text-sm text-timber-500">
                {loading
                  ? 'Loading…'
                  : `${products.length} piece${products.length === 1 ? '' : 's'}`}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 border border-timber-200 bg-white px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-timber-700 lg:hidden"
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
                    className="appearance-none border border-timber-200 bg-white py-2.5 pl-4 pr-10 text-[11px] font-medium uppercase tracking-[0.14em] text-timber-700 focus:outline-none focus:ring-1 focus:ring-timber-800"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-timber-400" />
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
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-2 xl:grid-cols-3 xl:gap-x-6">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
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
