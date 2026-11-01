const BASE_URL = (process.env.BOSTA_BASE_URL || 'https://app.bosta.co').replace(/\/$/, '');
const API_KEY = process.env.BOSTA_API_KEY || '';

const isConfigured = () => Boolean(API_KEY);

const apiPublicUrl = () =>
  (process.env.API_PUBLIC_URL || process.env.APP_URL || 'http://localhost:5000').replace(
    /\/$/,
    ''
  );

/** Normalize Egyptian mobile for Bosta (01xxxxxxxxx). */
const normalizeEgyptPhone = (phone) => {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.startsWith('0020')) p = p.slice(4);
  if (p.startsWith('20') && p.length >= 11) p = p.slice(2);
  if (p.length === 10 && p.startsWith('1')) p = `0${p}`;
  return p;
};

const normalizeDistrictKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/** Checkout "Other" is not a place — the street is the area. */
const isUnspecifiedArea = (value) =>
  /^(other|أخرى|اخرى|n\/a|na|-|—)$/i.test(String(value || '').trim());

/** Area text is sent exactly as the customer entered it. Nothing is renamed. */
const resolveDistrictName = (city) => {
  const raw = String(city || '').trim();
  if (!raw || isUnspecifiedArea(raw)) return '';
  return raw;
};

/**
 * Map checkout address → Bosta drop-off fields.
 * Governorate → Bosta city. Area → district. Street stays firstLine, unchanged.
 */
const resolveDropOffAddress = (address = {}) => {
  const state = String(address.state || '').trim();
  const cityRaw = String(address.city || '').trim();
  const street = String(address.street || '').trim();
  const zip = String(address.zip || '').trim();

  if (!state) {
    const err = new Error('Governorate is required before creating a Bosta shipment');
    err.status = 400;
    throw err;
  }

  const areaLabel = resolveDistrictName(cityRaw);
  const streetAlreadyHasArea =
    areaLabel && street.toLowerCase().includes(areaLabel.toLowerCase());
  // Visible line is the website address: street, area, governorate.
  const firstLine = [street, streetAlreadyHasArea ? '' : areaLabel, state]
    .filter(Boolean)
    .join(', ');

  return {
    city: state,
    zone: areaLabel || state,
    districtName: areaLabel || state,
    district: areaLabel || state,
    unspecifiedArea: !areaLabel,
    firstLine: firstLine.slice(0, 250),
    secondLine: [areaLabel, zip, state, 'Egypt'].filter(Boolean).join(' · ').slice(0, 180),
    customerStreet: street,
    customerCity: cityRaw,
    customerState: state,
  };
};

const normalizeMatch = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, '')
    .trim();

/**
 * Spelling variants for the same governorate. Used only to find that governorate
 * in Bosta's live city list. Never used to pick a different governorate.
 */
const GOVERNORATE_ALIASES = {
  cairo: ['cairo', 'القاهرة', 'القاهره'],
  giza: ['giza', 'الجيزة', 'الجيزه'],
  alexandria: ['alexandria', 'الاسكندرية', 'الإسكندرية'],
  dakahlia: ['dakahlia', 'dakahliah', 'الدقهلية'],
  'red sea': ['redsea', 'البحراحمر', 'البحرالأحمر'],
  beheira: ['beheira', 'behera', 'elbeheira', 'البحيرة'],
  fayoum: ['fayoum', 'faiyum', 'fayum', 'الفيوم'],
  gharbia: ['gharbia', 'gharbiya', 'الغربية'],
  ismailia: ['ismailia', 'ismailiya', 'الإسماعيلية', 'الاسماعيلية'],
  menofia: ['menofia', 'menoufia', 'monufia', 'المنوفية'],
  minya: ['minya', 'menya', 'المنيا'],
  qalyubia: ['qalyubia', 'qaliubia', 'kalubia', 'القليوبية'],
  'new valley': ['newvalley', 'elwadielgedid', 'الواديالجديد'],
  suez: ['suez', 'السويس'],
  aswan: ['aswan', 'أسوان', 'اسوان'],
  assiut: ['assiut', 'assuit', 'asyut', 'أسيوط', 'اسيوط'],
  'beni suef': ['benisuef', 'banisuef', 'benisuif', 'بنيسويف'],
  'port said': ['portsaid', 'بورسعيد'],
  damietta: ['damietta', 'dumyat', 'دمياط'],
  sharqia: ['sharqia', 'sharkia', 'sharqiya', 'الشرقية'],
  'south sinai': ['southsinai', 'جنوبسيناء'],
  'kafr el sheikh': ['kafrelsheikh', 'كفرالشيخ'],
  matrouh: ['matrouh', 'matruh', 'مطروح'],
  luxor: ['luxor', 'الأقصر', 'الاقصر'],
  qena: ['qena', 'qina', 'قنا'],
  'north sinai': ['northsinai', 'شمالسيناء'],
  sohag: ['sohag', 'suhag', 'سوهاج'],
};

const governorateAliasSet = (state) => {
  const key = normalizeDistrictKey(state);
  const list = GOVERNORATE_ALIASES[key] || [state];
  return new Set(list.map((name) => normalizeMatch(name)));
};

const catalogNames = (item) =>
  [item?.name, item?.Name, item?.nameEn, item?.nameAr, item?.alias, item?.cityName].filter(Boolean);

/**
 * Pick the one Bosta city that is this governorate.
 * Match is exact against the city's own name/alias. Codes are taken from that
 * record afterwards — a stale local code table is never used.
 */
const findGovernorateCity = (cities, state) => {
  const aliases = governorateAliasSet(state);
  const hits = (Array.isArray(cities) ? cities : []).filter((city) =>
    catalogNames(city).some((name) => aliases.has(normalizeMatch(name)))
  );
  if (hits.length === 1) return hits[0];
  return null;
};

/** Cache Bosta city catalog briefly to avoid hammering on retries. */
let citiesCache = { at: 0, list: null };

const listCities = async () => {
  if (citiesCache.list && Date.now() - citiesCache.at < 10 * 60 * 1000) {
    return citiesCache.list;
  }
  let data;
  try {
    data = await request('GET', '/api/v2/cities');
  } catch (err) {
    // Governorates rarely change — a stale catalog beats failing the shipment.
    if (citiesCache.list?.length) return citiesCache.list;
    throw err;
  }
  const list =
    data?.data?.list ||
    data?.data?.cities ||
    data?.data ||
    data?.cities ||
    data?.list ||
    (Array.isArray(data) ? data : []);
  const normalized = Array.isArray(list) ? list : [];
  if (normalized.length) citiesCache = { at: Date.now(), list: normalized };
  return normalized;
};

/** Arabic spelling variants Bosta's catalog flattens (ة→ه, أ→ا, ى→ي). */
const foldArabic = (value) =>
  String(value || '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ً-ْـ]/g, '');

/** Words of a place name, lowercased, with the "El"/"Al"/"ال" article dropped. */
const areaWords = (value) =>
  foldArabic(String(value || '').toLowerCase())
    .split(/[^a-z0-9؀-ۿ]+/)
    .filter(Boolean)
    .map((w) => w.replace(/^(el|al)(?=[a-z]{3})/, '').replace(/^ال(?=[؀-ۿ]{2})/, ''))
    .filter((w) => !['el', 'al', 'ال'].includes(w));

const areaKey = (value) => areaWords(value).join('');

/** Spelling-insensitive key: "Shebin El Kom" and "Shebeen ElKom" agree. */
const areaSkeleton = (value) => {
  const key = areaKey(value);
  return /[a-z]/.test(key) ? key.replace(/[aeiouy]+/g, '').replace(/(.)\1+/g, '$1') : key;
};

/**
 * Common names customers type that Bosta files under another name.
 * Scoped to one governorate (keys are areaKey of the typed name), and each
 * points at the same place — never a neighbour.
 */
const AREA_ALIASES = {
  cairo: {
    heliopolis: 'Masr ElGedida',
    'مصرالجديده': 'Masr ElGedida',
    downtown: 'Downtown Cairo',
    wustbalad: 'Downtown Cairo',
    'وسطالبلد': 'Downtown Cairo',
    tagamoa: 'New Cairo',
    'تجمع': 'New Cairo',
    'تجمعالخامس': 'New Cairo',
    fifthsettlement: 'New Cairo',
    '5thsettlement': 'New Cairo',
  },
  giza: {
    '6thofoctober': '6 October',
    sixthofoctober: '6 October',
    october: '6 October',
    'اكتوبر': '6 October',
    '6اكتوبر': '6 October',
    'سادسمناكتوبر': '6 October',
    hadayekahram: 'Pyramids Gardens',
    hadaiqahram: 'Pyramids Gardens',
    'حدائقالاهرام': 'Pyramids Gardens',
  },
};

const districtNames = (d) => [d.districtName, d.districtOtherName].filter(Boolean);
const zoneNames = (d) => [d.zoneName, d.zoneOtherName].filter(Boolean);

/** A zone stands for its own same-named district when Bosta has one. */
const zoneMainDistrict = (hits) =>
  hits.find((d) => areaKey(d.districtName) === areaKey(d.zoneName)) || hits[0];

/**
 * Find the Bosta district for what the customer wrote, inside one governorate.
 * Exact names first, then spelling-insensitive. A name that fits two different
 * zones is never guessed between.
 */
const matchDistrict = (districts, area) => {
  const usable = (Array.isArray(districts) ? districts : []).filter(
    (d) => d.dropOffAvailability !== false
  );
  for (const fold of [areaKey, areaSkeleton]) {
    const want = fold(area);
    if (!want) continue;
    for (const [namesOf, isZone] of [
      [districtNames, false],
      [zoneNames, true],
    ]) {
      const hits = usable.filter((d) => namesOf(d).some((n) => fold(n) === want));
      if (!hits.length) continue;
      if (!isZone && hits.length === 1) return hits[0];
      if (new Set(hits.map((d) => d.zoneId)).size === 1) return zoneMainDistrict(hits);
      return null;
    }
  }
  return null;
};

/**
 * Checkout "Other": look for one Bosta place named word-for-word in the street.
 * Only used when every name found sits in the same zone.
 */
const matchDistrictInStreet = (districts, street) => {
  const words = areaWords(street);
  if (!words.length) return null;
  const text = ` ${words.join(' ')} `;
  const found = [];
  for (const d of Array.isArray(districts) ? districts : []) {
    if (d.dropOffAvailability === false) continue;
    const names = [
      ...districtNames(d).map((n) => [n, false]),
      ...zoneNames(d).map((n) => [n, true]),
    ];
    for (const [name, isZone] of names) {
      const phrase = areaWords(name).join(' ');
      if (phrase.replace(/\s/g, '').length < 4 || /^[\d\s]+$/.test(phrase)) continue;
      if (text.includes(` ${phrase} `)) found.push({ d, isZone, len: phrase.length });
    }
  }
  if (!found.length || new Set(found.map((f) => f.d.zoneId)).size !== 1) return null;
  const named = found.filter((f) => !f.isZone).sort((a, b) => b.len - a.len);
  if (named.length) return named[0].d;
  return zoneMainDistrict(found.map((f) => f.d));
};

/** Bosta's districts for one city (governorate), cached like the city list. */
const districtsCache = new Map();

const listCityDistricts = async (cityId) => {
  const cached = districtsCache.get(cityId);
  if (cached && Date.now() - cached.at < 6 * 60 * 60 * 1000) return cached.list;
  const path = `/api/v2/cities/${encodeURIComponent(cityId)}/districts`;
  let data;
  try {
    data = await request('GET', path);
  } catch (err) {
    if (cached?.list?.length) return cached.list;
    // The catalog is public; if the business key is refused here, read it without one.
    console.error('Bosta districts with API key failed:', err.status, err.message);
    const res = await fetch(`${BASE_URL}${path}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch(() => null);
    data = res?.ok ? await res.json().catch(() => null) : null;
    if (!data) throw err;
  }
  const list = Array.isArray(data?.data) ? data.data : data?.data?.list || [];
  if (list.length) districtsCache.set(cityId, { at: Date.now(), list });
  return list;
};

const resolveGovernorateCity = async (state) => {
  const cities = await listCities();
  if (!Array.isArray(cities) || !cities.length) {
    const err = new Error('Could not load Bosta cities catalog');
    err.status = 502;
    throw err;
  }
  const cityHit = findGovernorateCity(cities, state);
  const cityId = cityHit?._id || cityHit?.id || cityHit?.cityId || cityHit?.cityID || null;
  if (!cityHit || !cityId) {
    const err = new Error(
      `Bosta has no city for governorate "${state}". The shipment was not created.`
    );
    err.status = 400;
    throw err;
  }
  return { cityHit, cityId: String(cityId) };
};

/**
 * Pick the Bosta district for an order: the one staff chose, else the
 * customer's area, else (area "Other") a place named in the street.
 */
const resolveOrderDistrict = (districts, address = {}, governorateName = '') => {
  const chosen = String(address.bostaDistrictId || '').trim();
  if (chosen) {
    const hit = districts.find((d) => d.districtId === chosen);
    if (hit) return { district: hit, source: 'staff' };
  }

  const state = String(address.state || '').trim();
  const area = resolveDistrictName(address.city);
  const areaIsGovernorate =
    area && [state, governorateName].some((name) => areaKey(name) === areaKey(area));

  if (area && !areaIsGovernorate) {
    const aliases = AREA_ALIASES[normalizeDistrictKey(state)] || {};
    const hit =
      matchDistrict(districts, area) ||
      (aliases[areaKey(area)] ? matchDistrict(districts, aliases[areaKey(area)]) : null);
    if (hit) return { district: hit, source: 'area' };
  }

  const fromStreet = matchDistrictInStreet(districts, address.street);
  if (fromStreet) return { district: fromStreet, source: 'street' };

  // Area is just the governorate ("Qena" in Qena): use the district of that
  // exact name when Bosta has one, never a neighbouring zone.
  if (areaIsGovernorate) {
    const usable = districts.filter((d) => d.dropOffAvailability !== false);
    for (const name of [area, governorateName]) {
      const hits = usable.filter((d) =>
        districtNames(d).some((n) => areaSkeleton(n) === areaSkeleton(name))
      );
      if (hits.length === 1) return { district: hits[0], source: 'area' };
    }
  }
  return null;
};

/**
 * Attach the governorate's Bosta city id and the matching Bosta district.
 * Bosta rejects any district name that is not in its own catalog (code 3003),
 * so the district is always Bosta's own record. District ids are not sent;
 * the customer's own street and area words stay in firstLine for the courier.
 */
const enrichDropOffAddress = async (dropOff, address = {}) => {
  const enriched = { ...dropOff };
  const state = dropOff.customerState || dropOff.city;
  const { cityHit, cityId } = await resolveGovernorateCity(state);

  const code = String(cityHit.code || cityHit.cityCode || '').trim();
  enriched.cityId = cityId;
  // Bosta routes on this city's code. The code comes from the matched governorate record.
  enriched.city = code || cityHit.name || state;
  enriched.governorateName = cityHit.name || state;

  const districts = await listCityDistricts(cityId);
  if (!districts.length) {
    const err = new Error(`Could not load Bosta areas for ${enriched.governorateName}`);
    err.status = 502;
    throw err;
  }
  const resolved = resolveOrderDistrict(districts, address, enriched.governorateName);
  if (!resolved) {
    const typed = resolveDistrictName(address.city);
    const err = new Error(
      typed
        ? `Bosta has no area matching "${typed}" in ${enriched.governorateName}. Choose the Bosta area on the order and retry.`
        : 'The order has no area (checkout "Other"). Choose the Bosta area on the order and retry.'
    );
    err.status = 400;
    err.code = 'district_required';
    throw err;
  }

  enriched.districtName = resolved.district.districtName;
  enriched.district = resolved.district.districtName;
  enriched.zone = resolved.district.zoneName;
  enriched.matchedDistrict = resolved.district;
  delete enriched.districtId;
  delete enriched.zoneId;
  delete enriched.buildingNumber;
  delete enriched.unspecifiedArea;
  delete enriched.customerStreet;
  delete enriched.customerCity;
  delete enriched.customerState;

  return enriched;
};

/**
 * Refuse to create a shipment when the payload would not be the address on the order.
 */
const assertDropOffMatchesCustomer = (dropOff, address = {}) => {
  const street = String(address.street || '').trim();
  const city = String(address.city || '').trim();
  const state = String(address.state || '').trim();
  const line = String(dropOff.firstLine || '');

  if (street && !line.includes(street)) {
    const err = new Error('Refusing to ship: Bosta address dropped the customer street');
    err.status = 409;
    throw err;
  }

  // The district is Bosta's spelling; the courier must still read the customer's own area words.
  const area = resolveDistrictName(city);
  if (area && !normalizeMatch(line).includes(normalizeMatch(area))) {
    const err = new Error(`Refusing to ship: Bosta address dropped the order area "${city}"`);
    err.status = 409;
    throw err;
  }

  if (state) {
    const governorateOk =
      normalizeMatch(dropOff.city) === normalizeMatch(state) ||
      normalizeMatch(line).includes(normalizeMatch(state));
    if (!governorateOk) {
      const err = new Error(
        `Refusing to ship: Bosta governorate "${dropOff.city}" does not match "${state}"`
      );
      err.status = 409;
      throw err;
    }
  }
};

const extractBostaError = (data, status) => {
  if (data == null) return `Bosta request failed (${status})`;
  if (typeof data === 'string') return data;
  const parts = [
    data.message,
    data.error,
    data.detail,
    data.errorMessage,
    data.errorCode != null ? `code ${data.errorCode}` : null,
  ]
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .filter(Boolean)
    .map((v) => (typeof v === 'string' ? v : JSON.stringify(v)));
  if (parts.length) return parts.join(' — ');
  try {
    return JSON.stringify(data);
  } catch {
    return `Bosta request failed (${status})`;
  }
};

const REQUEST_TIMEOUT_MS = 20000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Connection never reached Bosta — safe to resend even a POST. */
const isConnectError = (err) =>
  ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET'].includes(err?.cause?.code);

const request = async (method, path, body) => {
  if (!isConfigured()) {
    const err = new Error('Bosta is not configured');
    err.status = 503;
    throw err;
  }

  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  // GETs retry on any transient failure. A POST only retries when Bosta cannot
  // have created anything (no connection, 429, 503) so shipments never duplicate.
  const maxAttempts = 3;
  for (let attempt = 1; ; attempt += 1) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: API_KEY,
          'Content-Type': 'application/json',
          'X-Requested-By': 'futurefit',
        },
        body: body != null ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      const retry = method === 'GET' || isConnectError(cause);
      if (retry && attempt < maxAttempts) {
        await sleep(attempt * 1000);
        continue;
      }
      const timedOut = cause?.name === 'TimeoutError';
      const err = new Error(
        timedOut
          ? `Bosta did not answer within ${REQUEST_TIMEOUT_MS / 1000}s`
          : `Could not reach Bosta: ${cause?.cause?.code || cause?.message || 'network error'}`
      );
      err.status = 502;
      // A timed-out POST may still have been created on Bosta's side.
      err.maybeCreated = method !== 'GET' && timedOut;
      throw err;
    }

    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;

    const retry =
      res.status === 429 || res.status === 503 || (method === 'GET' && res.status >= 500);
    if (retry && attempt < maxAttempts) {
      await sleep(attempt * 1500);
      continue;
    }
    const err = new Error(extractBostaError(data, res.status));
    err.status = res.status >= 400 && res.status < 500 ? res.status : 502;
    err.payload = data;
    throw err;
  }
};

const splitName = (fullName) => {
  const parts = String(fullName || 'Customer').trim().split(/\s+/);
  const firstName = parts[0] || 'Customer';
  const lastName = parts.slice(1).join(' ') || 'FutureFit';
  return { firstName, lastName };
};

/**
 * Create a Bosta SEND delivery for an order.
 * Pickup uses the business default location from the Bosta dashboard
 * (or BOSTA_BUSINESS_LOCATION_ID if set). Only BOSTA_API_KEY is required.
 */
const createDelivery = async ({
  orderId,
  customerName,
  phone,
  email,
  address = {},
  codAmount = 0,
  notes = '',
  itemsCount = 1,
  description = 'FutureFit order',
}) => {
  const { firstName, lastName } = splitName(customerName);
  const normalizedPhone = normalizeEgyptPhone(phone);
  if (!normalizedPhone || normalizedPhone.length < 10) {
    const err = new Error('A valid Egyptian phone number is required for shipping');
    err.status = 400;
    throw err;
  }

  const dropOffAddress = await enrichDropOffAddress(resolveDropOffAddress(address), address);
  assertDropOffMatchesCustomer(dropOffAddress, address);
  const matchedDistrict = dropOffAddress.matchedDistrict;
  delete dropOffAddress.matchedDistrict;
  const writtenAddress = [
    address.street,
    isUnspecifiedArea(address.city) ? '' : address.city,
    address.state,
    address.zip,
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');

  if (!dropOffAddress.cityId) {
    const err = new Error('Bosta requires cityId on dropOffAddress');
    err.status = 502;
    throw err;
  }

  const payload = {
    type: 10,
    cod: Math.max(0, Math.round(Number(codAmount) || 0)),
    businessReference: `${process.env.BOSTA_REF_PREFIX || 'FF'}-${orderId}`,
    notes: [notes || `FutureFit order ${orderId}`, writtenAddress && `Deliver to: ${writtenAddress}`]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 500),
    webhookUrl: `${apiPublicUrl()}/api/bosta/webhook`,
    receiver: {
      firstName,
      lastName,
      phone: normalizedPhone,
      email: email || undefined,
    },
    dropOffAddress,
    specs: {
      packageDetails: {
        itemsCount: Math.max(1, Number(itemsCount) || 1),
        description: String(description).slice(0, 200),
      },
    },
  };

  // If set, pick up from this location; otherwise Bosta uses the account default
  const locationId = process.env.BOSTA_BUSINESS_LOCATION_ID?.trim();
  if (locationId) payload.businessLocationId = locationId;

  const data = await request('POST', '/api/v2/deliveries?apiVersion=1', payload);
  const inner = data?.data || data;
  const deliveryId = inner?._id || inner?.id || inner?.deliveryId || null;
  const trackingNumber = inner?.trackingNumber || inner?.tracking_number || null;

  if (!deliveryId && !trackingNumber) {
    const err = new Error(
      `Bosta answered without a tracking number. Check the Bosta dashboard for ${payload.businessReference} before retrying.`
    );
    err.status = 502;
    err.maybeCreated = true;
    throw err;
  }

  return { deliveryId, trackingNumber, raw: data };
};

/** Map Bosta webhook state (numeric code or label) → FutureFit OrderStatus */
const mapBostaStateToOrderStatus = (state) => {
  if (state == null || state === '') return null;

  // Numeric codes from Bosta webhook docs
  const code = Number(state);
  if (Number.isFinite(code) && String(state).trim() !== '') {
    const CODE_MAP = {
      10: 'confirmed', // Pickup requested
      11: 'confirmed', // Waiting for route
      20: 'confirmed', // Route assigned
      21: 'out_for_delivery', // Picked up from business
      22: 'out_for_delivery',
      23: 'out_for_delivery',
      24: 'confirmed', // Received at warehouse
      25: 'confirmed', // Fulfilled
      30: 'out_for_delivery', // In transit between hubs
      40: 'out_for_delivery',
      41: 'out_for_delivery', // Picked up / heading to customer
      45: 'delivered',
      46: 'problem', // Returned to business
      47: 'problem', // Exception
      48: 'canceled', // Terminated
      49: 'canceled',
      60: 'canceled', // Returned to stock
      100: 'problem', // Lost
      101: 'problem', // Damaged
      102: 'problem', // Investigation
      103: 'problem', // Awaiting your action
      104: 'canceled', // Archived
      105: 'confirmed', // On hold
    };
    if (CODE_MAP[code]) return CODE_MAP[code];
  }

  const s = String(state || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  if (!s) return null;
  if (['delivered', 'completed', 'successful'].some((k) => s.includes(k))) return 'delivered';
  if (
    [
      'pickedup',
      'pickingup',
      'intransit',
      'outfordelivery',
      'onhold',
      'headingtocustomer',
      'routeassigned',
    ].some((k) => s.includes(k))
  ) {
    return 'out_for_delivery';
  }
  if (['canceled', 'cancelled', 'terminated', 'returned', 'rto', 'archived'].some((k) => s.includes(k))) {
    return 'canceled';
  }
  if (
    ['exception', 'failed', 'problem', 'returnedtocorporate', 'lost', 'damaged'].some((k) =>
      s.includes(k)
    )
  ) {
    return 'problem';
  }
  if (
    ['created', 'waitingforroute', 'receivedatwarehouse', 'new', 'pickuprequested'].some((k) =>
      s.includes(k)
    )
  ) {
    return 'confirmed';
  }
  return null;
};

module.exports = {
  isConfigured,
  createDelivery,
  mapBostaStateToOrderStatus,
  normalizeEgyptPhone,
  resolveDropOffAddress,
  assertDropOffMatchesCustomer,
  findGovernorateCity,
  resolveGovernorateCity,
  listCityDistricts,
  resolveOrderDistrict,
};
