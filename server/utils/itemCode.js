const prisma = require('../lib/prisma');

const CODE_RE = /^FF-(\d+)$/;
const CODE_FLOOR = 10000;
const CUSTOM_RE = /^[A-Z0-9][A-Z0-9_-]{0,31}$/;

/** Empty means “assign one”. Otherwise letters, numbers, and hyphens, stored uppercase. */
const cleanItemCode = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const code = raw.toUpperCase().replace(/\s+/g, '-');
  if (!CUSTOM_RE.test(code)) {
    const err = new Error('Item ID can use letters, numbers, and hyphens (up to 32 characters)');
    err.status = 400;
    throw err;
  }
  return code;
};

/** Next staff-only item code. Codes are FF-10001, FF-10002, … */
const nextItemCode = async (db = prisma) => {
  const rows = await db.product.findMany({
    where: { itemCode: { startsWith: 'FF-' } },
    select: { itemCode: true },
  });
  let max = CODE_FLOOR;
  for (const row of rows) {
    const match = CODE_RE.exec(row.itemCode || '');
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `FF-${String(max + 1).padStart(5, '0')}`;
};

/**
 * Assign codes to products that don't have one, oldest first.
 * Returns how many codes were written.
 */
const backfillItemCodes = async () => {
  const [missing, existing] = await Promise.all([
    prisma.product.findMany({
      where: { itemCode: null },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.product.findMany({
      where: { itemCode: { startsWith: 'FF-' } },
      select: { itemCode: true },
    }),
  ]);
  let max = CODE_FLOOR;
  for (const row of existing) {
    const match = CODE_RE.exec(row.itemCode || '');
    if (match) max = Math.max(max, Number(match[1]));
  }
  if (!missing.length) return 0;
  await prisma.$transaction(
    missing.map((product, index) =>
      prisma.product.update({
        where: { id: product.id },
        data: { itemCode: `FF-${String(max + 1 + index).padStart(5, '0')}` },
      })
    )
  );
  return missing.length;
};

module.exports = { nextItemCode, backfillItemCodes, cleanItemCode };
