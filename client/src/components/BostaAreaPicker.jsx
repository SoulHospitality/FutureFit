import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/axios';
import { citiesForGovernorate } from '../utils/helpers';

/** Areas per governorate, shared by every form on the page. */
const areaCache = new Map();

export const loadBostaAreas = (governorate) => {
  if (!governorate) return Promise.resolve([]);
  if (!areaCache.has(governorate)) {
    const request = api
      .get('/bosta/areas', { params: { governorate } })
      .then(({ data }) => (Array.isArray(data?.areas) ? data.areas : []))
      .catch((err) => {
        areaCache.delete(governorate);
        throw err;
      });
    areaCache.set(governorate, request);
  }
  return areaCache.get(governorate);
};

const fold = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ً-ْـ]/g, '')
    .split(/[^a-z0-9؀-ۿ]+/)
    .filter(Boolean)
    .map((w) => w.replace(/^(el|al)(?=[a-z]{3})/, '').replace(/^ال(?=[؀-ۿ]{2})/, ''))
    .join('');

/** Vowel-free key so "shebin" finds Bosta's "Shebeen ElKom". */
const skeleton = (folded) =>
  /[a-z]/.test(folded) ? folded.replace(/[aeiouy]+/g, '').replace(/(.)\1+/g, '$1') : folded;

export const areaLabel = (area) =>
  !area ? '' : area.zone && area.zone !== area.name ? `${area.name} — ${area.zone}` : area.name;

const MAX_SHOWN = 60;

/**
 * Searchable area picker backed by Bosta's own district list, so every address
 * saved or ordered with it is one Bosta accepts. Falls back to the static list
 * if Bosta's areas cannot be loaded, so checkout never blocks on it.
 *
 * onChange receives { city, bostaDistrictId }.
 */
export default function BostaAreaPicker({
  governorate,
  city,
  bostaDistrictId,
  onChange,
  onStatus,
  className = 'input',
  id,
}) {
  const [areas, setAreas] = useState(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);

  useEffect(() => {
    setAreas(null);
    setFailed(false);
    if (!governorate) return undefined;
    let alive = true;
    onStatus?.('loading');
    loadBostaAreas(governorate)
      .then((list) => {
        if (!alive) return;
        setAreas(list);
        onStatus?.(list.length ? 'ready' : 'empty');
      })
      .catch(() => {
        if (!alive) return;
        setFailed(true);
        onStatus?.('failed');
      });
    return () => {
      alive = false;
    };
  }, [governorate]);

  // Saved addresses from before this picker have an area name but no Bosta id.
  useEffect(() => {
    if (!areas?.length || bostaDistrictId || !city) return;
    const want = fold(city);
    const hits = areas.filter((a) => [a.name, a.nameAr].some((n) => fold(n) === want));
    if (hits.length === 1) onChange({ city: hits[0].name, bostaDistrictId: hits[0].id });
  }, [areas, bostaDistrictId, city]);

  useEffect(() => {
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const selected = areas?.find((a) => a.id === bostaDistrictId) || null;

  const matches = useMemo(() => {
    if (!areas) return [];
    const q = fold(query);
    if (!q) return areas.slice(0, MAX_SHOWN);
    const qs = skeleton(q);
    const scored = [];
    for (const a of areas) {
      const names = [a.name, a.nameAr].map(fold);
      const zones = [a.zone, a.zoneAr].map(fold);
      let score = -1;
      if (names.some((n) => n.startsWith(q))) score = 0;
      else if (zones.some((z) => z.startsWith(q))) score = 1;
      else if ([...names, ...zones].some((n) => n.includes(q))) score = 2;
      else if (qs.length >= 2 && [...names, ...zones].some((n) => skeleton(n).includes(qs))) score = 3;
      if (score >= 0) scored.push([score, a]);
    }
    return scored
      .sort((x, y) => x[0] - y[0])
      .slice(0, MAX_SHOWN)
      .map(([, a]) => a);
  }, [areas, query]);

  if (!governorate) {
    return (
      <select id={id} className={className} disabled value="">
        <option value="">Select governorate first</option>
      </select>
    );
  }

  if (failed) {
    const cities = citiesForGovernorate(governorate);
    return (
      <select
        id={id}
        required
        className={className}
        value={cities.includes(city) ? city : ''}
        onChange={(e) => onChange({ city: e.target.value, bostaDistrictId: '' })}
      >
        <option value="">Select city / area</option>
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    );
  }

  if (areas && !areas.length) {
    return (
      <p className="text-sm text-red-700">
        Delivery is not available to {governorate} yet. Please choose another governorate.
      </p>
    );
  }

  const choose = (area) => {
    onChange({ city: area.name, bostaDistrictId: area.id });
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && matches[active]) {
      e.preventDefault();
      choose(matches[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        className={className}
        disabled={!areas}
        placeholder={areas ? 'Search your area (English or عربي)…' : 'Loading areas…'}
        value={open ? query : areaLabel(selected)}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      {/* Lets the browser's own required check catch a missing area. */}
      <input
        tabIndex={-1}
        aria-hidden="true"
        required
        value={selected ? selected.id : ''}
        onChange={() => {}}
        className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0"
      />
      {open && areas && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto border border-timber-200 bg-white text-sm shadow-lg"
        >
          {matches.length ? (
            matches.map((a, i) => (
              <li
                key={a.id}
                role="option"
                aria-selected={a.id === bostaDistrictId}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(a);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 ${i === active ? 'bg-timber-100' : ''}`}
              >
                <span className="text-timber-900">{a.name}</span>
                {a.zone && a.zone !== a.name && (
                  <span className="text-timber-500"> — {a.zone}</span>
                )}
                {a.nameAr && <span className="float-right text-timber-400" dir="rtl">{a.nameAr}</span>}
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-timber-500">
              No area matches. Try a nearby area or the Arabic name.
            </li>
          )}
          {!query && areas.length > MAX_SHOWN && (
            <li className="px-3 py-2 text-xs text-timber-400">Type to search all {areas.length} areas…</li>
          )}
        </ul>
      )}
      {city && !selected && areas && (
        <p className="mt-1 text-xs text-amber-800">
          “{city}” isn’t in the courier’s list. Please search and choose your area.
        </p>
      )}
    </div>
  );
}
