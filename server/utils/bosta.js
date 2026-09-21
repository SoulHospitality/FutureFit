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

/** Latin-script text is safe for Bosta city/zone catalog names. */
const isLatinText = (value) => {
  const s = String(value || '').trim();
  if (!s) return false;
  return /^[\p{Script=Latin}\d\s.'\-_/]+$/u.test(s);
};

/** Common free-text / Arabic districts → Bosta-friendly English names. */
const DISTRICT_ALIASES = {
  'new cairo': 'New Cairo',
  'القاهره الجديده': 'New Cairo',
  'القاهرة الجديدة': 'New Cairo',
  'القاهره الجديدة': 'New Cairo',
  'القاهرة الجديده': 'New Cairo',
  'التجمع': 'New Cairo',
  'التجمع الخامس': 'New Cairo',
  'rehab': 'El Rehab',
  'el rehab': 'El Rehab',
  الرحاب: 'El Rehab',
  'nasr city': 'Nasr City',
  'مدينة نصر': 'Nasr City',
  maadi: 'Maadi',
  المعادي: 'Maadi',
  '6th of october': '6th of October',
  'sixth of october': '6th of October',
  '6 october': '6th of October',
  'أكتوبر': '6th of October',
  'sheikh zayed': 'Sheikh Zayed',
  'الشيخ زايد': 'Sheikh Zayed',
  heliopolis: 'Heliopolis',
  مصرالجديدة: 'Heliopolis',
  'مصر الجديدة': 'Heliopolis',
  mokattam: 'Mokattam',
  المقطم: 'Mokattam',
  dokki: 'Dokki',
  الدقي: 'Dokki',
  mohandessin: 'Mohandessin',
  المهندسين: 'Mohandessin',
  zamalek: 'Zamalek',
  الزمالك: 'Zamalek',
};

const normalizeDistrictKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const resolveDistrictName = (city, fallback) => {
  const raw = String(city || '').trim();
  if (!raw) return fallback;
  const aliased = DISTRICT_ALIASES[normalizeDistrictKey(raw)];
  if (aliased) return aliased;
  // Latin free-text district names are fine; Arabic unknown → use fallback city
  if (isLatinText(raw)) return raw;
  return fallback;
};

/**
 * Map checkout address → Bosta drop-off fields.
 * Bosta requires districtId or districtName (error 777).
 * Arabic / free-form areas are sent as districtName + firstLine; zone stays Latin.
 */
const resolveDropOffAddress = (address = {}) => {
  const state = String(address.state || '').trim();
  const city = String(address.city || '').trim();
  const street = String(address.street || '').trim();
  const zip = String(address.zip || '').trim();
  const country = String(address.country || 'Egypt').trim();

  const dropCity = isLatinText(state) ? state : isLatinText(city) ? city : 'Cairo';
  const dropZone = isLatinText(city) ? city : dropCity;
  const districtName = resolveDistrictName(city, dropZone || dropCity);
  const districtNote = city && city !== districtName ? city : '';
  const firstLine =
    [street, districtNote, zip].filter(Boolean).join(', ') || `${dropCity}, Egypt`;

  return {
    city: dropCity,
    zone: dropZone,
    districtName,
    firstLine: firstLine.slice(0, 180),
    secondLine: country || 'Egypt',
  };
};

const GOVERNORATE_CITY_CODES = {
  Cairo: 'EG-01',
  Giza: 'EG-02',
  Alexandria: 'EG-03',
  Dakahlia: 'EG-05',
  'Red Sea': 'EG-31',
  Beheira: 'EG-18',
  Fayoum: 'EG-15',
  Gharbia: 'EG-09',
  Ismailia: 'EG-19',
  Menofia: 'EG-10',
  Minya: 'EG-24',
  Qalyubia: 'EG-04',
  'New Valley': 'EG-32',
  Suez: 'EG-20',
  Aswan: 'EG-28',
  Assiut: 'EG-25',
  'Beni Suef': 'EG-22',
  'Port Said': 'EG-21',
  Damietta: 'EG-11',
  Sharqia: 'EG-13',
  'South Sinai': 'EG-30',
  'Kafr El Sheikh': 'EG-14',
  Matrouh: 'EG-33',
  Luxor: 'EG-29',
  Qena: 'EG-27',
  'North Sinai': 'EG-34',
  Sohag: 'EG-26',
};

const normalizeMatch = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, '')
    .trim();

const pickNamed = (list, wanted) => {
  const want = normalizeMatch(wanted);
  if (!want || !Array.isArray(list)) return null;
  return (
    list.find((item) => {
      const names = [
        item?.name,
        item?.Name,
        item?.nameEn,
        item?.nameAr,
        item?.districtName,
        item?.zoneName,
        item?.cityName,
      ]
        .filter(Boolean)
        .map(normalizeMatch);
      return names.some((n) => n === want || n.includes(want) || want.includes(n));
    }) || null
  );
};

/** Cache Bosta city catalog briefly to avoid hammering on retries. */
let citiesCache = { at: 0, list: null };

const listCities = async () => {
  if (citiesCache.list && Date.now() - citiesCache.at < 10 * 60 * 1000) {
    return citiesCache.list;
  }
  const data = await request('GET', '/api/v2/cities');
  const list =
    data?.data?.list ||
    data?.data?.cities ||
    data?.data ||
    data?.cities ||
    data?.list ||
    (Array.isArray(data) ? data : []);
  const normalized = Array.isArray(list) ? list : [];
  citiesCache = { at: Date.now(), list: normalized };
  return normalized;
};

const listCityDistricts = async (cityId) => {
  if (!cityId) return [];
  for (const path of [
    `/api/v2/cities/${cityId}/districts`,
    `/api/v2/cities/${cityId}/zones`,
  ]) {
    try {
      const data = await request('GET', path);
      const list =
        data?.data?.districts ||
        data?.data?.zones ||
        data?.data ||
        data?.districts ||
        data?.zones ||
        (Array.isArray(data) ? data : []);
      if (Array.isArray(list) && list.length) return list;
    } catch {
      /* try next path */
    }
  }
  return [];
};

/**
 * Resolve Bosta catalog IDs so create-delivery accepts the address.
 * Newer Bosta validation: districtName requires peer cityId (error 777).
 */
const enrichDropOffAddress = async (dropOff) => {
  const enriched = { ...dropOff };
  const cities = await listCities();
  if (!Array.isArray(cities) || !cities.length) {
    const err = new Error('Could not load Bosta cities catalog');
    err.status = 502;
    throw err;
  }

  const cityCodeHint = GOVERNORATE_CITY_CODES[dropOff.city] || GOVERNORATE_CITY_CODES.Cairo;
  const cityHit =
    pickNamed(cities, dropOff.city) ||
    cities.find((c) => String(c?.code || c?.cityCode || '') === String(cityCodeHint || '')) ||
    pickNamed(cities, 'Cairo') ||
    cities[0];

  const cityId =
    cityHit?._id ||
    cityHit?.id ||
    cityHit?.cityId ||
    cityHit?.cityID ||
    null;

  if (!cityId) {
    const err = new Error(
      'Bosta cityId missing for this address. Check BOSTA_API_KEY can read /api/v2/cities.'
    );
    err.status = 502;
    throw err;
  }

  enriched.cityId = String(cityId);
  if (cityHit?.nameEn || cityHit?.name) {
    enriched.city = cityHit.nameEn || cityHit.name;
  } else if (cityCodeHint) {
    enriched.city = cityCodeHint;
  }

  const districts = await listCityDistricts(cityId);
  const districtHit =
    pickNamed(districts, dropOff.districtName) ||
    pickNamed(districts, dropOff.zone) ||
    pickNamed(districts, 'New Cairo') ||
    pickNamed(districts, dropOff.city) ||
    districts[0] ||
    null;

  if (districtHit) {
    const districtId =
      districtHit.districtId ||
      districtHit._id ||
      districtHit.id ||
      districtHit.zoneId ||
      null;
    const districtName =
      districtHit.districtName ||
      districtHit.name ||
      districtHit.nameEn ||
      districtHit.zoneName ||
      enriched.districtName;
    // Prefer IDs — Bosta pairs cityId with districtId/districtName
    if (districtId) enriched.districtId = String(districtId);
    if (districtName) {
      enriched.districtName = districtName;
      enriched.zone = districtName;
    }
    const zoneId = districtHit.zoneId || districtHit.zone?._id || null;
    if (zoneId) enriched.zoneId = String(zoneId);
  }

  if (!enriched.districtName && !enriched.districtId) {
    enriched.districtName = enriched.zone || 'New Cairo';
  }
  if (!enriched.buildingNumber) enriched.buildingNumber = '1';

  return enriched;
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

const request = async (method, path, body) => {
  if (!isConfigured()) {
    const err = new Error('Bosta is not configured');
    err.status = 503;
    throw err;
  }

  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: API_KEY,
      'Content-Type': 'application/json',
      'X-Requested-By': 'futurefit',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(extractBostaError(data, res.status));
    err.status = res.status >= 400 && res.status < 500 ? res.status : 502;
    err.payload = data;
    throw err;
  }
  return data;
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

  const dropOffAddress = await enrichDropOffAddress(resolveDropOffAddress(address));

  if (!dropOffAddress.cityId) {
    const err = new Error('Bosta requires cityId on dropOffAddress');
    err.status = 502;
    throw err;
  }

  const payload = {
    type: 10,
    cod: Math.max(0, Math.round(Number(codAmount) || 0)),
    businessReference: `${process.env.BOSTA_REF_PREFIX || 'FF'}-${orderId}`,
    notes: notes || `FutureFit order ${orderId}`,
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

  return {
    deliveryId: inner?._id || inner?.id || inner?.deliveryId || null,
    trackingNumber: inner?.trackingNumber || inner?.tracking_number || null,
    raw: data,
  };
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
};
