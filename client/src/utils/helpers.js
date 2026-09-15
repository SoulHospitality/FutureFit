/** Normalize Drive / remote image URLs for <img src> */
export const getImageUrl = (path, { width } = {}) => {
  if (!path) return '';
  if (path.startsWith('blob:') || path.startsWith('data:')) return path;

  // Google Drive uc?export=view often fails in <img>; lh3 serves public files reliably.
  const isDriveRelated =
    /drive\.google\.com|drive\.usercontent\.google\.com|lh3\.googleusercontent\.com\/d\//.test(
      path
    );

  let url = path;
  if (isDriveRelated) {
    const id =
      path.match(/\/file\/d\/([^/?&#]+)/)?.[1] ||
      path.match(/lh3\.googleusercontent\.com\/d\/([^?=&#]+)/)?.[1] ||
      path.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
    if (id) url = `https://lh3.googleusercontent.com/d/${id}`;
  } else if (!path.startsWith('http')) {
    // Local catalog assets ship as WebP; rewrite legacy .png DB paths.
    url = path.replace(/\/images\/products\/([^/?#]+)\.png$/i, '/images/products/$1.webp');
  }

  if (url.includes('res.cloudinary.com') && width) {
    return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
  }

  if (width && url.includes('googleusercontent.com') && !/=[sw]\d/.test(url)) {
    return `${url}=w${width}`;
  }

  if (url.startsWith('http')) return url;
  return url;
};

const preloadedUrls = new Set();

/** Warm the browser cache so gallery switches feel instant. */
export const preloadImage = (url) => {
  if (!url || preloadedUrls.has(url)) return;
  preloadedUrls.add(url);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
};

export const preloadImages = (urls = []) => {
  for (const url of urls) preloadImage(url);
};

export const PRODUCT_TYPES = [
  { value: 'boxers', label: 'Boxers' },
  { value: 'briefs', label: 'Briefs' },
  { value: 'trunks', label: 'Trunks' },
  { value: 'undershirt', label: 'Undershirts' },
  { value: 'socks', label: 'Socks' },
  { value: 'bundle', label: 'Bundles' },
];

export const AUDIENCES = [
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'kids', label: 'Kids' },
];

/** Fallback department cover photos when no catalog product exists yet. */
export const DEPT_IMAGES = {
  men: '/images/products/uw-hero-1.webp',
  women: '/images/products/uw-hero-2.webp',
  kids: '/images/products/uw-bundle.webp',
};

export const audienceLabel = (value) =>
  AUDIENCES.find((a) => a.value === value)?.label || value;

export const categoryLabel = (product) =>
  product?.category?.name ||
  PRODUCT_TYPES.find((t) => t.value === product?.type)?.label ||
  '';

const COLOR_SWATCH = {
  black: '#111111',
  white: '#f4f4f5',
  'off white': '#f5f5f4',
  'off-white': '#f5f5f4',
  navy: '#1e3a5f',
  grey: '#737373',
  gray: '#737373',
  'light grey': '#d4d4d8',
  'dark grey': '#52525b',
  'light gray': '#d4d4d8',
  'dark gray': '#52525b',
  charcoal: '#36454f',
  ash: '#9ca3af',
  brown: '#6b4423',
  wheat: '#c4a574',
  beige: '#d8c3a5',
  biege: '#d8c3a5',
  cream: '#f5f0e6',
  ivory: '#fffff0',
  nude: '#e8d5c4',
  skin: '#e8d5c4',
  sand: '#c2b280',
  camel: '#c19a6b',
  tan: '#d2b48c',
  red: '#b91c1c',
  'dark red': '#7f1d1d',
  rose: '#e11d48',
  pink: '#ec4899',
  coral: '#f97066',
  maroon: '#7f1d1d',
  burgundy: '#6b1c23',
  wine: '#722f37',
  blue: '#2563eb',
  'sky blue': '#38bdf8',
  'light blue': '#93c5fd',
  'dark blue': '#1e3a8a',
  indigo: '#4338ca',
  teal: '#0d9488',
  green: '#16a34a',
  mint: '#6ee7b7',
  olive: '#556b2f',
  khaki: '#c3b091',
  yellow: '#eab308',
  mustard: '#ca8a04',
  gold: '#d4a017',
  orange: '#ea580c',
  rust: '#b7410e',
  purple: '#7e22ce',
  lavender: '#c4b5fd',
  silver: '#c0c0c0',
  natural: '#e7e5e4',
  multicolor: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
};

export const colorSwatch = (name) => {
  const raw = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (COLOR_SWATCH[raw]) return COLOR_SWATCH[raw];
  const parts = raw.split(/[\s/]+/).filter(Boolean);
  // Prefer multi-word matches first (dark red, sky blue)
  for (let n = Math.min(parts.length, 3); n >= 1; n--) {
    const phrase = parts.slice(0, n).join(' ');
    if (COLOR_SWATCH[phrase]) return COLOR_SWATCH[phrase];
  }
  for (const p of parts) {
    if (COLOR_SWATCH[p]) return COLOR_SWATCH[p];
  }
  return '#a1a1aa';
};

/** Inline style for a colour chip (supports solid + CSS gradients). */
export const colorSwatchStyle = (name) => {
  const value = colorSwatch(name);
  return String(value).includes('gradient')
    ? { background: value }
    : { backgroundColor: value };
};

/** Gallery images for a selected colour (falls back to all product photos). */
export const photosForColor = (product, color) => {
  if (!product) return [];
  const map = product.photoByColor;
  if (color && map && typeof map === 'object') {
    let mapped = map[color];
    if (mapped == null) {
      const key = Object.keys(map).find(
        (k) => k.toLowerCase() === String(color).toLowerCase()
      );
      if (key) mapped = map[key];
    }
    if (mapped != null) {
      const list = (Array.isArray(mapped) ? mapped : [mapped]).filter(Boolean);
      if (list.length) return list;
    }
  }
  return Array.isArray(product.photos) && product.photos.length ? product.photos : [];
};

export const formatMoney = (n) =>
  new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

/** Coerce API payloads to an array (avoids `.map is not a function` on error objects). */
export const asArray = (value) => (Array.isArray(value) ? value : []);

/** Units available for a specific size. Falls back to product-level stock. */
export const getSizeStock = (product, size) => {
  const rows = product?.sizeStocks;
  if (Array.isArray(rows) && rows.length) {
    if (!size) return 0;
    const row = rows.find((r) => r.size === size);
    return row ? Number(row.stock) || 0 : 0;
  }
  return Number(product?.stock) || 0;
};

export const totalStock = (product) => {
  const rows = product?.sizeStocks;
  if (Array.isArray(rows) && rows.length) {
    return rows.reduce((sum, row) => sum + (Number(row.stock) || 0), 0);
  }
  return Number(product?.stock) || 0;
};


export const FREE_SHIPPING_MIN = 2000;
export const SHIPPING_FEE = 75;

export const PAYMENT_METHODS = [
  {
    value: 'Cash on Delivery',
    label: 'Cash on Delivery',
    hint: 'Pay cash when your order arrives.',
  },
  {
    value: 'Paymob',
    label: 'Card / Wallet',
    hint: 'Pay securely online with card or mobile wallet via Paymob.',
  },
  {
    value: 'InstaPay',
    label: 'InstaPay',
    hint: 'Transfer via InstaPay after placing your order. We’ll confirm once received.',
  },
];

export const INSTAPAY_HANDLE = import.meta.env.VITE_INSTAPAY_HANDLE || '';

export const calcShipping = (subtotal) =>
  Number(subtotal) >= FREE_SHIPPING_MIN || Number(subtotal) === 0 ? 0 : SHIPPING_FEE;

/** Operating costs for underwear brand ops (packaging, fabric, ads, etc.). */
export const EXPENSE_CATEGORIES = [
  { value: 'marketing', label: 'Marketing' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'rent', label: 'Rent' },
  { value: 'salary', label: 'Salary' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'other', label: 'Other' },
];

export const expenseCategoryLabel = (value) =>
  EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || value;

export const orderStatusLabel = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  canceled: 'Canceled',
  problem: 'Problem',
};

export const orderStatusBadge = {
  pending: 'badge-yellow',
  confirmed: 'badge-blue',
  out_for_delivery: 'badge-wheat',
  delivered: 'badge-green',
  canceled: 'badge-gray',
  problem: 'badge-red',
};

/** Shopify-style relative date: "Monday at 10:20 pm" / "Sep 1 at 4:27 pm" */
export const formatStaffDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const diffDays = Math.floor((now - d) / 86400000);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  if (diffDays < 7 && sameYear) {
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    return `${weekday} at ${time}`;
  }
  const day = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `${day} at ${time}`;
};

export const isBostaSynced = (order) =>
  Boolean(order?.bostaTrackingNumber || order?.bostaDeliveryId);

export const paymentStatusMeta = (order) => {
  if (order?.status === 'canceled') {
    return { label: 'Voided', className: 'sp-pill sp-pill-void' };
  }
  if (order?.isPaid) {
    return { label: 'Paid', className: 'sp-pill sp-pill-paid' };
  }
  return { label: 'Payment pending', className: 'sp-pill sp-pill-pending' };
};

export const fulfillmentStatusMeta = (order) => {
  if (order?.status === 'canceled') {
    return { label: 'Canceled', className: 'sp-pill sp-pill-void' };
  }
  if (order?.status === 'delivered' || isBostaSynced(order)) {
    return { label: 'Fulfilled', className: 'sp-pill sp-pill-ok' };
  }
  if (order?.status === 'problem') {
    return { label: 'Problem', className: 'sp-pill sp-pill-danger' };
  }
  return { label: 'Unfulfilled', className: 'sp-pill sp-pill-warn' };
};

export const deliveryStatusMeta = (order) => {
  if (order?.status === 'delivered') {
    return { label: 'Delivered', className: 'sp-pill sp-pill-ok' };
  }
  if (order?.status === 'out_for_delivery') {
    return { label: 'Out for delivery', className: 'sp-pill sp-pill-info' };
  }
  if (order?.status === 'canceled') {
    return { label: 'Canceled', className: 'sp-pill sp-pill-void' };
  }
  if (isBostaSynced(order)) {
    return { label: order?.shippingStatus || 'Synced', className: 'sp-pill sp-pill-info' };
  }
  return { label: 'Not shipped', className: 'sp-pill sp-pill-void' };
};

/** Last N days of totals from orders (for tiny sparklines). */
export const sparkSeriesFromOrders = (orders, days = 7, field = 'count') => {
  const buckets = Array.from({ length: days }, () => 0);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  for (const o of asArray(orders)) {
    if (o.status === 'canceled') continue;
    const d = new Date(o.createdAt);
    if (Number.isNaN(d.getTime()) || d < start) continue;
    const idx = Math.floor((d - start) / 86400000);
    if (idx < 0 || idx >= days) continue;
    buckets[idx] += field === 'revenue' ? Number(o.totalPrice) || 0 : 1;
  }
  return buckets;
};
