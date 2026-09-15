require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { ensureDefaultCategories } = require('../utils/catalog');

const prisma = new PrismaClient();

(async () => {
  await ensureDefaultCategories(prisma);
  const rows = await prisma.category.findMany({
    orderBy: [{ audience: 'asc' }, { sortOrder: 'asc' }],
    select: { name: true, slug: true, audience: true, parentId: true },
  });
  for (const r of rows) {
    console.log(
      `${r.audience} | ${r.slug.padEnd(12)} | ${r.parentId ? 'sub' : 'CATEGORY'} | ${r.name}`
    );
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
