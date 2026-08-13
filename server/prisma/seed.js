require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/** Local product photos served from the Vite public folder */
const photo = (file) => `/images/products/${file}`;

const SLIDES = [
  {
    title: 'Underwear, elevated.',
    description: 'Boxers, briefs, trunks, and base layers — soft fabrics, clean fits.',
    cloudinaryUrl: photo('uw-hero-1.png'),
    sortOrder: 0,
  },
  {
    title: 'All-day comfort.',
    description: 'FutureFit essentials designed for support, stretch, and lasting wear.',
    cloudinaryUrl: photo('uw-hero-2.png'),
    sortOrder: 1,
  },
  {
    title: 'Setting trends with every stitch.',
    description: 'From single pairs to packs — build your everyday rotation.',
    cloudinaryUrl: photo('uw-bundle.png'),
    sortOrder: 2,
  },
];

const PRODUCTS = [
  {
    name: 'Relaxed Cotton Boxers',
    description:
      'Classic woven boxer shorts with a soft covered waistband.\n• Breathable cotton poplin\n• Loose lounge fit\n• Everyday comfort',
    price: 349,
    type: 'boxers',
    photos: [photo('uw-boxers-white.png'), photo('uw-boxers-navy.png')],
    colors: ['White', 'Navy', 'Black'],
    sizes: ['S', 'M', 'L', 'XL'],
    stock: 52,
    isSaleActive: false,
  },
  {
    name: 'Noir Soft Boxers',
    description:
      'Soft black boxers for lounge and sleep.\n• Smooth knit feel\n• Gentle elastic waist\n• Tag-free comfort',
    price: 329,
    type: 'boxers',
    photos: [photo('uw-boxers-black.png'), photo('uw-boxers-white.png')],
    colors: ['Black', 'Charcoal'],
    sizes: ['S', 'M', 'L', 'XL'],
    stock: 44,
    isSaleActive: false,
  },
  {
    name: 'Contour Stretch Briefs',
    description:
      'Supportive brief with a clean contour pouch.\n• Soft stretch cotton\n• Stay-put waistband\n• Secure everyday fit',
    price: 279,
    type: 'briefs',
    photos: [photo('uw-briefs-black.png'), photo('uw-briefs-white.png')],
    colors: ['Black', 'White'],
    sizes: ['S', 'M', 'L', 'XL'],
    stock: 60,
    isSaleActive: false,
  },
  {
    name: 'Everyday Brief Pack',
    description:
      'Mix-and-match briefs for the week.\n• Soft stretch\n• Breathable knit\n• Rotation ready',
    price: 899,
    salePrice: 749,
    type: 'briefs',
    photos: [photo('uw-briefs-white.png'), photo('uw-briefs-black.png')],
    colors: ['Black/White Mix'],
    sizes: ['S', 'M', 'L', 'XL'],
    stock: 30,
    isSaleActive: true,
  },
  {
    name: 'Performance Trunks',
    description:
      'Modern trunk cut — shorter leg, locked-in fit.\n• Moisture-wicking knit\n• Mid-rise waist\n• Flatlock seams',
    price: 349,
    type: 'trunks',
    photos: [photo('uw-trunks-black.png'), photo('uw-trunks-grey.png')],
    colors: ['Black', 'Ash'],
    sizes: ['S', 'M', 'L', 'XL'],
    stock: 38,
    isSaleActive: false,
  },
  {
    name: 'Modal Soft Trunks',
    description:
      'Ultra-soft modal trunks for all-day wear.\n• Silky modal blend\n• Gentle stretch\n• No ride-up hem',
    price: 399,
    salePrice: 329,
    type: 'trunks',
    photos: [photo('uw-trunks-grey.png'), photo('uw-trunks-black.png')],
    colors: ['Grey', 'Black'],
    sizes: ['S', 'M', 'L', 'XL'],
    stock: 26,
    isSaleActive: true,
  },
  {
    name: 'Crew Undershirt',
    description:
      'Slim crew undershirt that stays tucked and invisible.\n• Soft stretch knit\n• Moisture control\n• Holds shape after wash',
    price: 379,
    type: 'undershirt',
    photos: [photo('uw-undershirt-white.png'), photo('uw-undershirt-black.png')],
    colors: ['White', 'Black', 'Grey'],
    sizes: ['S', 'M', 'L', 'XL'],
    stock: 55,
    isSaleActive: false,
  },
  {
    name: 'Deep V Undershirt',
    description:
      'Low V-neck base layer for open collars.\n• Lightweight cotton stretch\n• Smooth flat seams\n• Invisible under shirts',
    price: 369,
    type: 'undershirt',
    photos: [photo('uw-undershirt-black.png'), photo('uw-undershirt-white.png')],
    colors: ['Black', 'White'],
    sizes: ['S', 'M', 'L', 'XL'],
    stock: 41,
    isSaleActive: false,
  },
  {
    name: 'No-Show Sock Pack (3)',
    description:
      'Invisible ankle socks for sneakers.\n• Hidden cuff\n• Cushioned sole\n• Soft cotton blend',
    price: 249,
    type: 'socks',
    photos: [photo('uw-socks-pack.png'), photo('uw-socks-pack.png')],
    colors: ['Black', 'White', 'Grey'],
    sizes: ['One Size'],
    stock: 95,
    isSaleActive: false,
  },
  {
    name: 'Daily Underwear Bundle',
    description:
      'Complete set: boxers + briefs + undershirt.\n• Matching neutrals\n• Ready everyday kit\n• Gift-ready pack',
    price: 1099,
    salePrice: 899,
    type: 'bundle',
    photos: [photo('uw-bundle.png'), photo('uw-boxers-black.png'), photo('uw-undershirt-white.png')],
    colors: ['Black', 'White'],
    sizes: ['S', 'M', 'L', 'XL'],
    stock: 18,
    isSaleActive: true,
  },
];

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@futurefit.eg';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.env.ADMIN_NAME || 'FutureFit Admin';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, email, passwordHash, role: 'admin' },
  });
  console.log(`Seeded admin: ${email} / ${password}`);
}

async function seedCatalog() {
  await prisma.orderItem.deleteMany().catch(() => {});
  await prisma.slide.deleteMany();
  await prisma.product.deleteMany();

  await prisma.slide.createMany({ data: SLIDES });
  console.log(`Seeded ${SLIDES.length} hero slides`);

  for (const product of PRODUCTS) {
    await prisma.product.create({
      data: {
        name: product.name,
        description: product.description,
        price: product.price,
        salePrice: product.salePrice ?? null,
        isSaleActive: Boolean(product.isSaleActive),
        type: product.type,
        photos: product.photos,
        colors: product.colors,
        sizes: product.sizes,
        stock: product.stock,
      },
    });
  }
  console.log(`Seeded ${PRODUCTS.length} underwear products`);
}

async function main() {
  await seedAdmin();
  await seedCatalog();
  console.log('Underwear catalog refreshed — reload the storefront.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
