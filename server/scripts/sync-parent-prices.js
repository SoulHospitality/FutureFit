/**
 * Set parent.price = child price whenever every child shares the same price.
 * Usage: node scripts/sync-parent-prices.js
 */
require('dotenv').config();
const prisma = require('../lib/prisma');
const { uniformChildPrice } = require('../utils/variants');

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      itemCode: true,
      price: true,
      variants: { select: { price: true } },
    },
  });

  let updated = 0;
  for (const p of products) {
    if (!p.variants?.length) continue;
    const uniform = uniformChildPrice(p.variants);
    if (uniform == null) continue;
    if (Number(p.price) === uniform) continue;
    await prisma.product.update({
      where: { id: p.id },
      data: { price: uniform },
    });
    updated += 1;
    console.log(p.itemCode || p.id, Number(p.price), '→', uniform);
  }
  console.log(`Synced ${updated} of ${products.length} products`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
