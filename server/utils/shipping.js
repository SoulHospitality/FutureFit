const FREE_SHIPPING_MIN = 2000;

/** Lowest published rate (Cairo & Giza). Used when governorate is unknown. */
const SHIPPING_FEE_MIN = 85;
const SHIPPING_FEE_DEFAULT = 180;

const normalizeGovernorate = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

/** Normalized governorate → fee (EGP). Anything unmatched uses SHIPPING_FEE_DEFAULT. */
const RATE_BY_KEY = {
  cairo: 85,
  giza: 85,

  alexandria: 110,
  sharqia: 110,
  alsharqia: 110,
  sharkia: 110,
  beheira: 110,
  dakahlia: 110,
  damietta: 110,
  gharbia: 110,
  ismailia: 110,
  kafrelsheikh: 110,
  menofia: 110,
  monufia: 110,
  menoufia: 110,
  portsaid: 110,
  qalyubia: 110,
  qaliubiya: 110,
  suez: 110,

  asyut: 145,
  assiut: 145,
  benisuef: 145,
  fayoum: 145,
  faiyum: 145,
  minya: 145,
  sohag: 145,

  matrouh: 180,
  northsinai: 180,
  aswan: 180,
  luxor: 180,
  newvalley: 180,
  qena: 180,
  redsea: 180,
  southsinai: 180,
};

const getShippingRate = (governorate) => {
  const key = normalizeGovernorate(governorate);
  if (!key) return SHIPPING_FEE_DEFAULT;
  return RATE_BY_KEY[key] ?? SHIPPING_FEE_DEFAULT;
};

/**
 * @param {number} subtotal
 * @param {string} [governorate] address.state / governorate
 */
const calcShipping = (subtotal, governorate) => {
  const items = Number(subtotal) || 0;
  if (items === 0 || items >= FREE_SHIPPING_MIN) return 0;
  return getShippingRate(governorate);
};

module.exports = {
  FREE_SHIPPING_MIN,
  SHIPPING_FEE_MIN,
  SHIPPING_FEE_DEFAULT,
  getShippingRate,
  calcShipping,
};
