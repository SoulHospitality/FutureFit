const prisma = require('../lib/prisma');

const CODE_RE = /^FF-(\d+)$/;
const CODE_FLOOR = 10000;

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

module.exports = { nextItemCode, backfillItemCodes };
