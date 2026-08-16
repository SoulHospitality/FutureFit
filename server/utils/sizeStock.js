const normalizeSizeStocks = (body = {}) => {
  if (Array.isArray(body.sizeStocks)) {
    const seen = new Set();
    const rows = [];
    for (const row of body.sizeStocks) {
      const size = String(row?.size ?? '').trim();
      if (!size) continue;
      const key = size.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        size,
        stock: Math.max(0, Math.floor(Number(row.stock) || 0)),
      });
    }
    return rows;
  }

  const sizes = Array.isArray(body.sizes)
    ? body.sizes.map((s) => String(s).trim()).filter(Boolean)
    : [];
  if (!sizes.length) return [];

  const total = Math.max(0, Math.floor(Number(body.stock) || 0));
  const base = Math.floor(total / sizes.length);
  const remainder = total % sizes.length;
  return sizes.map((size, i) => ({
    size,
    stock: base + (i < remainder ? 1 : 0),
  }));
};

const sizeStockWrites = (rows) =>
  rows.map((row, i) => ({
    size: row.size,
    stock: row.stock,
    sortOrder: i,
  }));

const stockForSize = (product, size) => {
  const rows = product.sizeStocks || [];
  if (rows.length) {
    if (!size) return 0;
    const row = rows.find((r) => r.size === size);
    return row ? row.stock : 0;
  }
  return product.stock ?? 0;
};

const backfillMissingSizeStocks = async (prisma) => {
  const products = await prisma.product.findMany({
    where: { sizeStocks: { none: {} } },
    select: { id: true, sizes: true, stock: true },
  });
  for (const product of products) {
    if (!product.sizes?.length) continue;
    const total = Math.max(0, product.stock || 0);
    const base = Math.floor(total / product.sizes.length);
    const remainder = total % product.sizes.length;
    await prisma.productSize.createMany({
      data: product.sizes.map((size, i) => ({
        productId: product.id,
        size,
        stock: base + (i < remainder ? 1 : 0),
        sortOrder: i,
      })),
    });
  }
  return products.length;
};

module.exports = {
  normalizeSizeStocks,
  sizeStockWrites,
  stockForSize,
  backfillMissingSizeStocks,
};
