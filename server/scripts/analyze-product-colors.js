require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function baseName(title) {
  return String(title || '')
    .replace(/\s*,\s*[^,]+$/i, '')
    .replace(/\s+(White|Black|Grey|Gray|Navy|Red|Blue|Green|Beige|Biege|Rose|Pink|Multicolor|Dark Red|Charcoal|Brown|Cream|Ivory|Olive|Purple|Yellow|Orange|Maroon|Burgundy|Khaki|Sky Blue|Light Blue|Dark Blue|Light Grey|Dark Grey)\s*$/i, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function colorFromTitle(title) {
  const t = String(title || '').trim();
  const m = t.match(/,\s*([^,]+)$/);
  if (m && m[1].trim().length <= 40) return m[1].trim();
  const m2 = t.match(
    /\b(White|Black|Grey|Gray|Navy|Red|Blue|Green|Beige|Biege|Rose|Pink|Multicolor|Dark Red|Charcoal|Brown|Cream|Ivory|Olive|Purple|Yellow|Orange|Maroon|Burgundy|Khaki|Sky Blue|Light Blue|Dark Blue|Light Grey|Dark Grey)\s*$/i
  );
  return m2 ? m2[1] : null;
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      colors: true,
      photos: true,
      photoByColor: true,
      type: true,
      audience: true,
      price: true,
      sizeStocks: true,
    },
    orderBy: { name: 'asc' },
  });

  let withColor = 0;
  let withMap = 0;
  let noColor = 0;
  const groups = new Map();

  for (const p of products) {
    if (p.colors?.length) withColor++;
    else noColor++;
    if (p.photoByColor && Object.keys(p.photoByColor).length) withMap++;

    const base = baseName(p.name);
    const color = p.colors?.[0] || colorFromTitle(p.name) || 'Default';
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push({ ...p, _color: color, _base: base });
  }

  const multi = [...groups.entries()].filter(([, list]) => list.length > 1);
  const single = [...groups.entries()].filter(([, list]) => list.length === 1);

  console.log({
    total: products.length,
    withColor,
    noColor,
    withMap,
    multiColorGroups: multi.length,
    singleGroups: single.length,
  });

  console.log('\nSample multi groups:');
  for (const [base, list] of multi.slice(0, 8)) {
    console.log(
      base,
      '→',
      list.map((p) => `${p._color} (${p.photos?.length || 0} photos)`).join(', ')
    );
  }

  console.log('\nSample no-color singles:');
  for (const p of products.filter((x) => !x.colors?.length).slice(0, 10)) {
    console.log('-', p.name);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
