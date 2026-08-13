import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import api from '../api/axios';
import ProductCard from '../components/store/ProductCard';
import { PRODUCT_TYPES } from '../utils/helpers';
import EmptyState from '../components/ui/EmptyState';

const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

function parseBound(raw) {
  const trimmed = String(raw ?? '').trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function FiltersPanel({
  embedded = false,
  onClose,
  selectedTypes,
  selectedColors,
  selectedSizes,
  availableColors,
  availableSizes,
  minInput,
  maxInput,
  onMinChange,
  onMaxChange,
  onPriceBlur,
  onToggleType,
  onToggleColor,
  onToggleSize,
  onClear,
}) {
  return (
    <div className={embedded ? 'flex h-full flex-col' : 'flex flex-col'}>
      <div className="mb-8 shrink-0 border-b border-timber-200 pb-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-timber-400">
          Refine
        </p>
        <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-timber-900">
          Filters
        </h2>
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto pr-1">
        <div>
          <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.28em] text-timber-500">
            Category
          </p>
          <div className="space-y-3">
            {PRODUCT_TYPES.map((t) => (
              <label
                key={t.value}
                className="flex cursor-pointer items-center gap-3 text-sm text-timber-700"
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(t.value)}
                  onChange={() => onToggleType(t.value)}
                  className="h-3.5 w-3.5 rounded-none border-timber-300 text-timber-900 focus:ring-timber-800"
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        {availableColors.length > 0 && (
          <div className="border-t border-timber-100 pt-8">
            <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.28em] text-timber-500">
              Colors
            </p>
            <div className="max-h-40 space-y-3 overflow-y-auto">
              {availableColors.map((c) => (
                <label
                  key={c}
                  className="flex cursor-pointer items-center gap-3 text-sm text-timber-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedColors.includes(c)}
                    onChange={() => onToggleColor(c)}
                    className="h-3.5 w-3.5 rounded-none border-timber-300 text-timber-900 focus:ring-timber-800"
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>
        )}

        {availableSizes.length > 0 && (
          <div className="border-t border-timber-100 pt-8">
            <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.28em] text-timber-500">
              Sizes
            </p>
            <div className="flex flex-wrap gap-2">
              {availableSizes.map((s) => {
                const active = selectedSizes.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onToggleSize(s)}
                    className={`min-w-[2.75rem] border px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] transition ${
                      active
                        ? 'border-timber-900 bg-timber-900 text-white'
                        : 'border-timber-200 bg-white text-timber-700 hover:border-timber-900'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="border-t border-timber-100 pt-8">
          <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.28em] text-timber-500">
            Price (EGP)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="Min"
              className="input"
              value={minInput}
              onChange={(e) => onMinChange(e.target.value)}
              onBlur={onPriceBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onPriceBlur();
                  e.currentTarget.blur();
                }
              }}
            />
            <input
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="Max"
              className="input"
              value={maxInput}
              onChange={(e) => onMaxChange(e.target.value)}
              onBlur={onPriceBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onPriceBlur();
                  e.currentTarget.blur();
                }
              }}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          onClear();
          onClose?.();
        }}
        className="mt-8 w-full shrink-0 border border-timber-200 bg-white px-4 py-3 text-[11px] font-medium uppercase tracking-[0.22em] text-timber-600 transition hover:border-timber-900 hover:text-timber-900"
      >
        Clear filters
      </button>
    </div>
  );
}

export default function ShopPage() {
  const [params, setParams] = useSearchParams();
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileFilters, setMobileFilters] = useState(false);

  const selectedTypes = useMemo(() => {
    if (params.get('types')) return params.get('types').split(',').filter(Boolean);
    if (params.get('type')) return [params.get('type')];
    return [];
  }, [params]);
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
    api
      .get('/products')
      .then((r) => setAllProducts(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAllProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const patchParams = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) next.delete(k);
      else next.set(k, Array.isArray(v) ? v.join(',') : String(v));
    });
    if (patch.types !== undefined) next.delete('type');
    setParams(next, { replace: true });
  };

  const toggleInList = (key, list, value) => {
    const set = new Set(list);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    patchParams({ [key]: [...set] });
  };

  const toggleType = (value) => toggleInList('types', selectedTypes, value);

  const applyPriceToUrl = () => {
    patchParams({
      minPrice: minInput.trim() === '' ? null : minInput,
      maxPrice: maxInput.trim() === '' ? null : maxInput,
    });
  };

  const clearFilters = () => {
    setMinInput('');
    setMaxInput('');
    setParams(new URLSearchParams(), { replace: true });
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
    if (selectedTypes.length) list = list.filter((p) => selectedTypes.includes(p.type));
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
  }, [
    allProducts,
    selectedTypes,
    selectedColors,
    selectedSizes,
    minPrice,
    maxPrice,
    sort,
  ]);

  const filterProps = {
    selectedTypes,
    selectedColors,
    selectedSizes,
    availableColors,
    availableSizes,
    minInput,
    maxInput,
    onMinChange: setMinInput,
    onMaxChange: setMaxInput,
    onPriceBlur: applyPriceToUrl,
    onToggleType: toggleType,
    onToggleColor: (c) => toggleInList('colors', selectedColors, c),
    onToggleSize: (s) => toggleInList('sizes', selectedSizes, s),
    onClear: clearFilters,
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-white">
      <div className="border-b border-timber-100 bg-timber-50">
        <div className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-timber-400">
            FutureFit
          </p>
          <h1 className="mt-3 font-display text-5xl font-medium tracking-tight text-timber-900 sm:text-6xl">
            The collection
          </h1>
          <p className="mt-3 max-w-md text-sm text-timber-500">
            Classic cuts and refined staples — browse by category, colour, and size.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            <button
              type="button"
              onClick={() => patchParams({ types: [] })}
              className={`text-[11px] font-medium uppercase tracking-[0.24em] transition ${
                selectedTypes.length === 0
                  ? 'text-timber-900 underline underline-offset-8'
                  : 'text-timber-400 hover:text-timber-800'
              }`}
            >
              All
            </button>
            {PRODUCT_TYPES.map((t) => {
              const active = selectedTypes.length === 1 && selectedTypes[0] === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => patchParams({ types: [t.value] })}
                  className={`text-[11px] font-medium uppercase tracking-[0.24em] transition ${
                    active
                      ? 'text-timber-900 underline underline-offset-8'
                      : 'text-timber-400 hover:text-timber-800'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-28">
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
                subtitle="Try clearing filters or adjusting category, colour, size, or price."
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
          <div className="absolute inset-y-0 left-0 flex w-[min(100%,360px)] flex-col bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-timber-100 pb-4">
              <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-timber-800">
                Filters
              </span>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center hover:bg-timber-50"
                onClick={() => setMobileFilters(false)}
              >
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
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
