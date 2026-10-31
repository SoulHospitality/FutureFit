require('dotenv').config();
const prisma = require('./lib/prisma');

const digits = (phone) => String(phone || '').replace(/\D/g, '');

(async () => {
  const orders = await prisma.order.findMany({
    where: { status: { not: 'canceled' } },
    orderBy: { createdAt: 'desc' },
    take: 80,
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      isPaid: true,
      bostaTrackingNumber: true,
      bostaDeliveryId: true,
      shippingStatus: true,
      createdAt: true,
      guestPhone: true,
      shippingAddress: true,
      user: { select: { phone: true } },
    },
  });

  const rows = orders.map((order) => {
    const address = order.shippingAddress && typeof order.shippingAddress === 'object' ? order.shippingAddress : {};
    const phone = order.user?.phone || order.guestPhone || address.phone || '';
    return {
      id: order.id.slice(0, 8),
      at: order.createdAt.toISOString().slice(0, 16),
      status: order.status,
      pay: order.paymentMethod,
      paid: order.isPaid,
      synced: Boolean(order.bostaTrackingNumber || order.bostaDeliveryId),
      ship: order.shippingStatus || '',
      state: address.state || '',
      city: address.city || '',
      streetLen: String(address.street || '').length,
      phoneLen: digits(phone).length,
      phoneOk: /^01\d{9}$/.test(digits(phone).replace(/^20/, '0').replace(/^1/, '01')),
    };
  });

  const unsynced = rows.filter((row) => !row.synced);
  console.log(
    JSON.stringify(
      {
        recent: rows.length,
        unsynced: unsynced.length,
        byStatus: unsynced.reduce((acc, row) => {
          acc[row.status] = (acc[row.status] || 0) + 1;
          return acc;
        }, {}),
        byPay: unsynced.reduce((acc, row) => {
          const key = `${row.pay}|paid:${row.paid}`;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {}),
        sample: unsynced.slice(0, 25),
      },
      null,
      2
    )
  );
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err.message);
  try { await prisma.$disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
