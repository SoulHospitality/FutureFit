const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL'];

const sizeRank = (size) => {
  const i = SIZE_ORDER.indexOf(String(size || '').toUpperCase());
  return i === -1 ? 100 : i;
};

const normalizeVariants = (body = {}) => {
  if (!Array.isArray(body.variants)) return [];
  const seen = new Set();
  const rows = [];
  for (const row of body.variants) {
    const color = String(row?.color ?? '').trim();
    const size = String(row?.size ?? '').trim();
    const itemCode = String(row?.itemCode ?? row?.item_id ?? '')
      .trim()
      .toUpperCase();
    if (!color || !size || !itemCode) continue;
    const key = `${color.toLowerCase()}::${size.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const price =
      row.price === '' || row.price == null ? null : Math.round(Number(row.price) * 100) / 100;
    const cost =
      row.cost === '' || row.cost == null ? null : Math.round(Number(row.cost) * 100) / 100;
    rows.push({
      itemCode,
      color,
      size,
      stock: Math.max(0, Math.floor(Number(row.stock) || 0)),
      price: Number.isFinite(price) ? price : null,
      cost: Number.isFinite(cost) ? cost : null,
      photos: Array.isArray(row.photos) ? row.photos.map(String).filter(Boolean) : [],
    });
  }
  return rows.sort(
    (a, b) =>
      a.color.localeCompare(b.color) || sizeRank(a.size) - sizeRank(b.size) || a.size.localeCompare(b.size)
  );
};

const variantWrites = (rows) =>
  rows.map((row, i) => ({
    itemCode: row.itemCode,
    color: row.color,
    size: row.size,
    stock: row.stock,
    price: row.price,
    cost: row.cost,
    photos: row.photos || [],
    sortOrder: i,
  }));

const findVariant = (product, color, size) => {
  const rows = product?.variants || [];
  if (!rows.length) return null;
  const c = String(color || '').trim().toLowerCase();
  const s = String(size || '').trim().toLowerCase();
  return (
    rows.find(
      (v) => String(v.color).trim().toLowerCase() === c && String(v.size).trim().toLowerCase() === s
    ) || null
  );
};

const stockForVariant = (product, color, size) => {
  const v = findVariant(product, color, size);
  if (v) return Number(v.stock) || 0;
  // Legacy size-only products
  const rows = product?.sizeStocks || [];
  if (rows.length) {
    if (!size) return 0;
    const row = rows.find((r) => r.size === size);
    return row ? row.stock : 0;
  }
  return product?.stock ?? 0;
};

const totalVariantStock = (product) => {
  const rows = product?.variants || [];
  if (rows.length) return rows.reduce((n, v) => n + (Number(v.stock) || 0), 0);
  const sizes = product?.sizeStocks || [];
  if (sizes.length) return sizes.reduce((n, v) => n + (Number(v.stock) || 0), 0);
  return Number(product?.stock) || 0;
};

const colorsFromVariants = (variants = []) => {
  const out = [];
  const seen = new Set();
  for (const v of variants) {
    const c = String(v.color || '').trim();
    if (!c) continue;
    const key = c.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
};

const sizesFromVariants = (variants = [], color = null) => {
  const rows = color
    ? variants.filter((v) => String(v.color).trim().toLowerCase() === String(color).trim().toLowerCase())
    : variants;
  const out = [];
  const seen = new Set();
  for (const v of [...rows].sort((a, b) => sizeRank(a.size) - sizeRank(b.size))) {
    const s = String(v.size || '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
};

const photoByColorFromVariants = (variants = []) => {
  const map = {};
  for (const v of variants) {
    const c = String(v.color || '').trim();
    if (!c || map[c]) continue;
    if (Array.isArray(v.photos) && v.photos.length) map[c] = v.photos;
  }
  return Object.keys(map).length ? map : null;
};

module.exports = {
  normalizeVariants,
  variantWrites,
  findVariant,
  stockForVariant,
  totalVariantStock,
  colorsFromVariants,
  sizesFromVariants,
  photoByColorFromVariants,
  sizeRank,
};
