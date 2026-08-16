/** Normalize Drive / remote image URLs for <img src> */
export const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('blob:') || path.startsWith('data:')) return path;

  // Google Drive uc?export=view often fails in <img>; lh3 serves public files reliably.
  const isDriveRelated =
    /drive\.google\.com|drive\.usercontent\.google\.com|lh3\.googleusercontent\.com\/d\//.test(
      path
    );

  if (isDriveRelated) {
    const id =
      path.match(/\/file\/d\/([^/?&#]+)/)?.[1] ||
      path.match(/lh3\.googleusercontent\.com\/d\/([^?=&#]+)/)?.[1] ||
      path.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
    if (id) return `https://lh3.googleusercontent.com/d/${id}`;
  }

  if (path.startsWith('http')) return path;
  return path;
};

export const PRODUCT_TYPES = [
  { value: 'boxers', label: 'Boxers' },
  { value: 'briefs', label: 'Briefs' },
  { value: 'trunks', label: 'Trunks' },
  { value: 'undershirt', label: 'Undershirts' },
  { value: 'socks', label: 'Socks' },
  { value: 'bundle', label: 'Bundles' },
];

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
    value: 'InstaPay',
    label: 'InstaPay',
    hint: 'Transfer via InstaPay after placing your order. We’ll confirm once received.',
  },
  {
    value: 'Vodafone Cash',
    label: 'Vodafone Cash',
    hint: 'Transfer via Vodafone Cash after placing your order. We’ll confirm once received.',
  },
];

export const INSTAPAY_HANDLE = import.meta.env.VITE_INSTAPAY_HANDLE || '';
export const VODAFONE_CASH_NUMBER = import.meta.env.VITE_VODAFONE_CASH_NUMBER || '';

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
