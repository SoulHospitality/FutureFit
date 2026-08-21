const app = require('./app');
const prisma = require('./lib/prisma');
const { backfillMissingSizeStocks } = require('./utils/sizeStock');
const { ensureDefaultCategories } = require('./utils/catalog');

const PORT = process.env.PORT || 5000;
const MAX_DB_ATTEMPTS = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const connectWithRetry = async () => {
  let lastError;
  for (let attempt = 1; attempt <= MAX_DB_ATTEMPTS; attempt += 1) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      lastError = error;
      console.error(
        `Database connect attempt ${attempt}/${MAX_DB_ATTEMPTS} failed: ${error.message}`
      );
      if (attempt < MAX_DB_ATTEMPTS) {
        await sleep(attempt * 1500);
      }
    }
  }
  throw lastError;
};

const start = async () => {
  try {
    await connectWithRetry();
    // Warm a couple of cheap queries (sequential to avoid pool stampede on cold start)
    await prisma.product.count().catch(() => null);
    await prisma.slide.count().catch(() => null);
    await backfillMissingSizeStocks(prisma).catch(() => null);
    await ensureDefaultCategories(prisma).catch(() => null);
    console.log('PostgreSQL connected (Supabase)');

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    const shutdown = async (signal) => {
      console.log(`${signal} received, shutting down…`);
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Failed to start server:', error.message);
    console.error(
      'Tip: In Supabase Dashboard → Project Settings → Database, confirm the project is not paused and copy a fresh connection string into server/.env (DATABASE_URL port 6543 with ?pgbouncer=true).'
    );
    process.exit(1);
  }
};

start();
