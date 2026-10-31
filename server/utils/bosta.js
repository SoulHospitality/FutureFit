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

/**
 * Attach the governorate's Bosta city id without changing the street or area.
 * District ids are not sent: Bosta treats a district id as the delivery place
 * and that was swapping areas in every governorate, not only Cairo.
 */
const enrichDropOffAddress = async (dropOff) => {
  const enriched = { ...dropOff };
  const cities = await listCities();
  if (!Array.isArray(cities) || !cities.length) {
    const err = new Error('Could not load Bosta cities catalog');
    err.status = 502;
    throw err;
  }

  const state = dropOff.customerState || dropOff.city;
  const cityHit = findGovernorateCity(cities, state);
  const cityId =
    cityHit?._id ||
    cityHit?.id ||
    cityHit?.cityId ||
    cityHit?.cityID ||
    null;

  if (!cityHit || !cityId) {
    const err = new Error(
      `Bosta has no city for governorate "${state}". The shipment was not created.`
    );
    err.status = 400;
    throw err;
  }

  const code = String(cityHit.code || cityHit.cityCode || '').trim();
  enriched.cityId = String(cityId);
  // Bosta routes on this city's code. The code comes from the matched governorate record.
  enriched.city = code || cityHit.name || state;
  enriched.governorateName = cityHit.name || state;

  // Area stays the customer's words in every governorate. With checkout "Other"
  // there is no area: Bosta rejects a whole street as a district name, so the
  // governorate is the district and the street stays in firstLine.
  const area = dropOff.unspecifiedArea
    ? enriched.governorateName
    : dropOff.districtName || dropOff.zone || state;
  enriched.districtName = area;
  enriched.district = area;
  enriched.zone = area;
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
  const district = String(dropOff.districtName || dropOff.district || '');

  if (street && !line.includes(street)) {
    const err = new Error('Refusing to ship: Bosta address dropped the customer street');
    err.status = 409;
    throw err;
  }

  if (city && !isUnspecifiedArea(city)) {
    const expected = resolveDistrictName(city);
    const districtOk = normalizeMatch(district) === normalizeMatch(expected);
    const lineOk = normalizeMatch(line).includes(normalizeMatch(expected));
    if (!districtOk || !lineOk) {
      const err = new Error(
        `Refusing to ship: Bosta area "${district}" does not match the order area "${city}"`
      );
      err.status = 409;
      throw err;
    }
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

  const dropOffAddress = await enrichDropOffAddress(resolveDropOffAddress(address));
  assertDropOffMatchesCustomer(dropOffAddress, address);
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
};
