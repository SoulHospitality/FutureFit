require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma
  .$connect()
  .then(() => prisma.product.count())
  .then((c) => {
    console.log('count', c);
    return prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e.message);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
