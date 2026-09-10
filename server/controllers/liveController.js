const prisma = require('../lib/prisma');

/** Rough city → lat/lng for Egypt Live View pins (not GPS-accurate). */
const CITY_COORDS = {
  cairo: { lat: 30.0444, lng: 31.2357, label: 'Cairo' },
  giza: { lat: 30.0131, lng: 31.2089, label: 'Giza' },
  alexandria: { lat: 31.2001, lng: 29.9187, label: 'Alexandria' },
  alex: { lat: 31.2001, lng: 29.9187, label: 'Alexandria' },
  mansoura: { lat: 31.0409, lng: 31.3785, label: 'Mansoura' },
  tanta: { lat: 30.7865, lng: 31.0004, label: 'Tanta' },
  aswan: { lat: 24.0889, lng: 32.8998, label: 'Aswan' },
  luxor: { lat: 25.6872, lng: 32.6396, label: 'Luxor' },
  'port said': { lat: 31.2653, lng: 32.3019, label: 'Port Said' },
  suez: { lat: 29.9668, lng: 32.5498, label: 'Suez' },
  ismailia: { lat: 30.5965, lng: 32.2715, label: 'Ismailia' },
  zagazig: { lat: 30.5877, lng: 31.502, label: 'Zagazig' },
  damietta: { lat: 31.4165, lng: 31.8133, label: 'Damietta' },
  fayoum: { lat: 29.3084, lng: 30.8428, label: 'Fayoum' },
  minya: { lat: 28.1099, lng: 30.7503, label: 'Minya' },
  assiut: { lat: 27.1809, lng: 31.1837, label: 'Assiut' },
  sohag: { lat: 26.5569, lng: 31.6948, label: 'Sohag' },
  hurghada: { lat: 27.2579, lng: 33.8116, label: 'Hurghada' },
  sharm: { lat: 27.9158, lng: 34.33, label: 'Sharm El Sheikh' },
  '6th of october': { lat: 29.9381, lng: 30.9142, label: '6th of October' },
  'new cairo': { lat: 30.03, lng: 31.47, label: 'New Cairo' },
  maadi: { lat: 29.9602, lng: 31.2569, label: 'Maadi' },
  helwan: { lat: 29.8414, lng: 31.3003, label: 'Helwan' },
};

const resolveCity = (city, state) => {
  const raw = String(city || state || '')
    .trim()
    .toLowerCase();
  if (!raw) return { lat: 30.0444, lng: 31.2357, label: city || state || 'Egypt' };
  if (CITY_COORDS[raw]) return { ...CITY_COORDS[raw], label: city || CITY_COORDS[raw].label };
  const hit = Object.keys(CITY_COORDS).find((k) => raw.includes(k) || k.includes(raw));
  if (hit) return { ...CITY_COORDS[hit], label: city || CITY_COORDS[hit].label };
  return { lat: 26.8206, lng: 30.8025, label: city || state || 'Egypt' };
};

const ACTIVE_MS = 5 * 60 * 1000;

/** Public heartbeat from storefront. */
const pingPresence = async (req, res) => {
  try {
    const sessionKey = String(req.body?.sessionKey || '').trim();
    if (!sessionKey) return res.status(400).json({ message: 'sessionKey required' });

    const path = req.body?.path ? String(req.body.path).slice(0, 200) : null;
    const city = req.body?.city ? String(req.body.city).slice(0, 80) : null;
    const country = req.body?.country ? String(req.body.country).slice(0, 80) : 'Egypt';
    const coords = resolveCity(city, req.body?.state);

    const row = await prisma.storePresence.upsert({
      where: { sessionKey },
      create: {
        sessionKey,
        path,
        city: coords.label,
        country,
        lat: coords.lat,
        lng: coords.lng,
        lastSeenAt: new Date(),
      },
      update: {
        path,
        ...(city ? { city: coords.label, lat: coords.lat, lng: coords.lng } : {}),
        country,
        lastSeenAt: new Date(),
      },
    });

    // Opportunistic cleanup of stale presence (> 24h)
    const dayAgo = new Date(Date.now() - 24 * 3600000);
    prisma.storePresence.deleteMany({ where: { lastSeenAt: { lt: dayAgo } } }).catch(() => {});

    res.json({ ok: true, id: row.id });
  } catch (err) {
    console.error('pingPresence:', err);
    res.status(500).json({ message: err.message });
  }
};

const liveView = async (_req, res) => {
  try {
    const since = new Date(Date.now() - ACTIVE_MS);
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const [visitors, todayOrders, activeCarts, checkingOut] = await Promise.all([
      prisma.storePresence.findMany({
        where: { lastSeenAt: { gte: since } },
        orderBy: { lastSeenAt: 'desc' },
        take: 200,
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: dayStart }, status: { not: 'canceled' } },
        include: {
          items: true,
          user: { select: { name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.abandonedCheckout.count({
        where: {
          recoveryStatus: 'not_recovered',
          updatedAt: { gte: since },
        },
      }),
      prisma.abandonedCheckout.count({
        where: {
          recoveryStatus: 'not_recovered',
          lastStep: 'payment',
          updatedAt: { gte: since },
        },
      }),
    ]);

    const totalSales = todayOrders.reduce((s, o) => s + Number(o.totalPrice), 0);
    const purchased = todayOrders.filter((o) => o.isPaid || o.status === 'delivered').length;

    // Returning = ordered before today (same phone)
    const phones = [
      ...new Set(
        todayOrders
          .map((o) => (o.guestPhone || o.user?.phone || '').replace(/\s+/g, ''))
          .filter(Boolean)
      ),
    ];
    let returningOrders = 0;
    if (phones.length) {
      const prior = await prisma.order.findMany({
        where: {
          createdAt: { lt: dayStart },
          OR: [{ guestPhone: { in: phones } }, { user: { phone: { in: phones } } }],
        },
        select: { guestPhone: true, user: { select: { phone: true } } },
        take: 800,
      });
      const priorSet = new Set(
        prior.map((o) => (o.user?.phone || o.guestPhone || '').replace(/\s+/g, '')).filter(Boolean)
      );
      returningOrders = todayOrders.filter((o) => {
        const p = (o.guestPhone || o.user?.phone || '').replace(/\s+/g, '');
        return p && priorSet.has(p);
      }).length;
    }
    const newOrders = Math.max(0, todayOrders.length - returningOrders);

    const locationMap = {};
    for (const v of visitors) {
      const key = v.city || 'Unknown';
      locationMap[key] = (locationMap[key] || 0) + 1;
    }
    // Also fold today's order cities into location bars
    for (const o of todayOrders) {
      const city = o.shippingAddress?.city || o.shippingAddress?.state;
      if (!city) continue;
      locationMap[city] = (locationMap[city] || 0) + 1;
    }
    const sessionsByLocation = Object.entries(locationMap)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    const pins = [
      ...visitors.map((v) => ({
        id: `v-${v.id}`,
        type: 'visitor',
        lat: v.lat,
        lng: v.lng,
        label: v.city || 'Visitor',
        path: v.path,
        at: v.lastSeenAt,
      })),
      ...todayOrders.slice(0, 40).map((o) => {
        const coords = resolveCity(o.shippingAddress?.city, o.shippingAddress?.state);
        return {
          id: `o-${o.id}`,
          type: 'order',
          lat: coords.lat,
          lng: coords.lng,
          label: coords.label,
          orderId: o.id.slice(0, 8),
          total: Number(o.totalPrice),
          at: o.createdAt,
        };
      }),
    ];

    // Simple sparkline: last 12 hours order counts
    const hours = Array.from({ length: 12 }, (_, i) => {
      const h = new Date();
      h.setMinutes(0, 0, 0);
      h.setHours(h.getHours() - (11 - i));
      return h;
    });
    const sessionsSeries = hours.map((h) => {
      const next = new Date(h.getTime() + 3600000);
      return todayOrders.filter((o) => o.createdAt >= h && o.createdAt < next).length;
    });
    const salesSeries = hours.map((h) => {
      const next = new Date(h.getTime() + 3600000);
      return todayOrders
        .filter((o) => o.createdAt >= h && o.createdAt < next)
        .reduce((s, o) => s + Number(o.totalPrice), 0);
    });

    res.json({
      updatedAt: new Date().toISOString(),
      visitorsRightNow: visitors.length,
      totalSalesToday: totalSales,
      sessionsToday: todayOrders.length + visitors.length,
      ordersToday: todayOrders.length,
      customerBehavior: {
        activeCarts,
        checkingOut,
        purchased,
      },
      newVsReturning: {
        new: newOrders,
        returning: returningOrders,
      },
      sessionsByLocation,
      pins,
      series: {
        sessions: sessionsSeries,
        sales: salesSeries,
        orders: sessionsSeries,
      },
    });
  } catch (err) {
    console.error('liveView:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { pingPresence, liveView, resolveCity, CITY_COORDS };
