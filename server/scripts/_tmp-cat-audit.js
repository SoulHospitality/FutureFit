require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const cats = await prisma.category.findMany({
    where: { parentId: { not: null } },
    include: { _count: { select: { products: true } }, parent: { select: { name: true } } },
    orderBy: [{ audience: 'asc' }, { sortOrder: 'asc' }],
  });
  console.log('=== Products by subcategory ===');
  for (const c of cats) {
    console.log(`${c.parent?.name}/${c.name} (${c.slug}): ${c._count.products}`);
  }

  const samples = await prisma.product.findMany({
    take: 40,
    orderBy: { name: 'asc' },
    select: {
      name: true,
      audience: true,
      type: true,
      category: { select: { name: true, slug: true, parent: { select: { name: true } } } },
    },
  });
  console.log('\n=== Sample assignments ===');
  for (const p of samples) {
    console.log(
      `[${p.audience}] ${p.category?.parent?.name || '?'} > ${p.category?.name || 'NONE'} | ${p.name.slice(0, 70)}`
    );
  }

  const uncategorized = await prisma.product.count({ where: { categoryId: null } });
  console.log('\nUncategorized:', uncategorized);
  console.log('Total:', await prisma.product.count());
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
