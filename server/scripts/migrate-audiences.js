/**
 * Pre-db-push migration: Men/Women/Kids → Men/Women/Boys/Girls/Baby.
 * Safe to re-run. Uses raw SQL so it works before/after Prisma client regenerate.
 *
 * Usage: node scripts/migrate-audiences.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const run = async (sql, label) => {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log('OK:', label);
  } catch (err) {
    console.warn('Skip:', label, '→', err.message.split('\n')[0]);
  }
};

async function main() {
  console.log('Migrating audiences (kids → boys/girls/baby)…');

  for (const value of ['boys', 'girls', 'baby']) {
    await run(
      `ALTER TYPE "Audience" ADD VALUE IF NOT EXISTS '${value}'`,
      `add Audience.${value}`
    );
  }

  // Remap products still tagged kids
  await run(
    `
    UPDATE "Product"
    SET audience = CASE
      WHEN name ~* '(baby|infant|newborn)' OR name ~* 'underwear set' THEN 'baby'
      WHEN name ~* 'girl' OR name ~* 'pant(y|ies)' THEN 'girls'
      ELSE 'boys'
    END::"Audience"
    WHERE audience::text = 'kids'
    `,
    'remap Product.audience kids'
  );

  // Detach products from kids categories, then delete kids category rows
  await run(
    `
    UPDATE "Product" p
    SET "categoryId" = NULL
    FROM "Category" c
    WHERE p."categoryId" = c.id AND c.audience::text = 'kids'
    `,
    'detach products from kids categories'
  );

  await run(
    `DELETE FROM "Category" WHERE audience::text = 'kids' AND "parentId" IS NOT NULL`,
    'delete kids subcategories'
  );
  await run(
    `DELETE FROM "Category" WHERE audience::text = 'kids' OR slug = 'kids'`,
    'delete kids roots'
  );

  // Ensure new shop-sort columns exist, then copy legacy kids order → boys
  await run(
    `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shopSortBoys" INTEGER NOT NULL DEFAULT 0`,
    'add shopSortBoys'
  );
  await run(
    `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shopSortGirls" INTEGER NOT NULL DEFAULT 0`,
    'add shopSortGirls'
  );
  await run(
    `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shopSortBaby" INTEGER NOT NULL DEFAULT 0`,
    'add shopSortBaby'
  );

  await run(
    `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Product' AND column_name = 'shopSortKids'
      ) THEN
        UPDATE "Product"
        SET "shopSortBoys" = "shopSortKids"
        WHERE "shopSortKids" > 0 AND "shopSortBoys" = 0;
      END IF;
    END $$;
    `,
    'copy shopSortKids → shopSortBoys'
  );

  console.log('Audience migration finished.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
