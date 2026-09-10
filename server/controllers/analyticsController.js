const prisma = require('../lib/prisma');

const endOfDay = (to) => {
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  return end;
};

const startOfDay = (d) => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
};

const parseRange = (from, to) => {
  const end = to ? endOfDay(to) : endOfDay(new Date());
  const start = from ? startOfDay(from) : startOfDay(new Date(end.getTime() - 6 * 86400000));
  return { start, end };
};

const previousRange = (start, end) => {
  const ms = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - ms - 1),
    end: new Date(start.getTime() - 1),
  };
};

const bucketKey = (date, mode) => {
  const d = new Date(date);
  if (mode === 'hour') {
    return `${d.toISOString().slice(0, 13)}:00`;
  }
  return d.toISOString().slice(0, 10);
};

const buildBuckets = (start, end, mode) => {
  const keys = [];
  const cursor = new Date(start);
  if (mode === 'hour') {
    cursor.setMinutes(0, 0, 0);
    while (cursor <= end) {
      keys.push(bucketKey(cursor, 'hour'));
      cursor.setHours(cursor.getHours() + 1);
    }
  } else {
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      keys.push(bucketKey(cursor, 'day'));
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return keys;
};

const summarizeOrders = (orders) => {
  const active = orders.filter((o) => o.status !== 'canceled');
  const grossSales = active.reduce((s, o) => s + Number(o.itemsPrice), 0);
  const discounts = active.reduce((s, o) => s + Number(o.discountAmount), 0);
  const shipping = active.reduce((s, o) => s + Number(o.shippingPrice), 0);
  const netSales = grossSales - discounts;
  const totalSales = active.reduce((s, o) => s + Number(o.totalPrice), 0);
  const orderCount = active.length;
  const aov = orderCount ? totalSales / orderCount : 0;
  const paid = active.filter((o) => o.isPaid).reduce((s, o) => s + Number(o.totalPrice), 0);
  return {
    grossSales,
    discounts,
    shippingCharges: shipping,
    netSales,
    taxes: 0,
    returnFees: 0,
    salesReversals: 0,
    totalSales,
    orderCount,
    averageOrderValue: aov,
    paid,
    outstanding: totalSales - paid,
  };
};

const seriesFromOrders = (orders, start, end, mode) => {
  const keys = buildBuckets(start, end, mode);
  const map = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const o of orders) {
    if (o.status === 'canceled') continue;
    const k = bucketKey(o.createdAt, mode);
    if (k in map) map[k] += Number(o.totalPrice);
  }
  return keys.map((label) => ({ label, value: map[label] || 0 }));
};

const topProducts = (orders) => {
  const map = {};
  for (const o of orders) {
    if (o.status === 'canceled') continue;
    for (const item of o.items || []) {
      const key = item.productId || item.name;
      if (!map[key]) {
        map[key] = { productId: item.productId, name: item.name, qty: 0, revenue: 0 };
      }
      map[key].qty += item.qty || 0;
      map[key].revenue += Number(item.price) * (item.qty || 0);
    }
  }
  return Object.values(map)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 12);
};

const byLocation = (orders) => {
  const map = {};
  for (const o of orders) {
    if (o.status === 'canceled') continue;
    const addr = o.shippingAddress || {};
    const city = addr.city || 'Unknown';
    const state = addr.state || '';
    const country = addr.country || 'Egypt';
    const key = [country, state, city].filter(Boolean).join(' · ');
    if (!map[key]) map[key] = { label: key, country, state, city, orders: 0, revenue: 0 };
    map[key].orders += 1;
    map[key].revenue += Number(o.totalPrice);
  }
  return Object.values(map)
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 15);
};

const byChannel = (orders) => {
  // Single channel today
  const active = orders.filter((o) => o.status !== 'canceled');
  return [
    {
      channel: 'Online Store',
      orders: active.length,
      revenue: active.reduce((s, o) => s + Number(o.totalPrice), 0),
    },
  ];
};

const analyticsSummary = async (req, res) => {
  try {
    const { start, end } = parseRange(req.query.from, req.query.to);
    const prev = previousRange(start, end);
    const spanHours = (end - start) / 3600000;
    const mode = spanHours <= 48 ? 'hour' : 'day';

    const include = {
      items: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
    };
    const [orders, prevOrders, sessions, prevSessions] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: prev.start, lte: prev.end } },
        include,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.storePresence.count({
        where: { createdAt: { gte: start, lte: end } },
      }),
      prisma.storePresence.count({
        where: { createdAt: { gte: prev.start, lte: prev.end } },
      }),
    ]);

    const current = summarizeOrders(orders);
    const previous = summarizeOrders(prevOrders);
    const pct = (a, b) => {
      if (b === 0) return a === 0 ? 0 : 100;
      return Math.round(((a - b) / Math.abs(b)) * 1000) / 10;
    };

    const conversionRate = sessions > 0 ? (current.orderCount / sessions) * 100 : null;
    const prevConversion = prevSessions > 0 ? (previous.orderCount / prevSessions) * 100 : null;

    const customerStats = customerReturningStats(orders);
    const products = topProducts(orders);
    const locations = byLocation(orders);
    const insights = buildInsights({
      current,
      previous,
      products,
      locations,
      conversionRate,
      customerStats,
    });

    res.json({
      range: { from: start.toISOString(), to: end.toISOString(), mode },
      compareRange: { from: prev.start.toISOString(), to: prev.end.toISOString() },
      metrics: {
        ...current,
        sessions,
        conversionRate,
        returningCustomerRate: customerStats.returningRate,
        newCustomers: customerStats.newCount,
        returningCustomers: customerStats.returningCount,
        changes: {
          totalSales: pct(current.totalSales, previous.totalSales),
          orderCount: pct(current.orderCount, previous.orderCount),
          averageOrderValue: pct(current.averageOrderValue, previous.averageOrderValue),
          grossSales: pct(current.grossSales, previous.grossSales),
          conversionRate:
            prevConversion == null || conversionRate == null
              ? null
              : pct(conversionRate, prevConversion),
        },
      },
      previous,
      insights,
      salesOverTime: {
        current: seriesFromOrders(orders, start, end, mode),
        previous: seriesFromOrders(prevOrders, prev.start, prev.end, mode),
      },
      breakdown: {
        grossSales: current.grossSales,
        discounts: -current.discounts,
        salesReversals: 0,
        netSales: current.netSales,
        shippingCharges: current.shippingCharges,
        returnFees: 0,
        taxes: 0,
        totalSales: current.totalSales,
      },
      byProduct: products,
      byLocation: locations,
      byChannel: byChannel(orders),
      byStatus: orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {}),
    });
  } catch (err) {
    console.error('analyticsSummary:', err);
    res.status(500).json({ message: err.message });
  }
};

const customerKey = (o) => {
  const phone = (o.user?.phone || o.guestPhone || '').replace(/\s+/g, '');
  const email = (o.user?.email || o.guestEmail || '').toLowerCase();
  if (phone) return `p:${phone}`;
  if (email) return `e:${email}`;
  if (o.userId) return `u:${o.userId}`;
  return null;
};

const customerReturningStats = (orders) => {
  const active = orders.filter((o) => o.status !== 'canceled');
  const byCustomer = {};
  for (const o of active) {
    const key = customerKey(o);
    if (!key) continue;
    byCustomer[key] = (byCustomer[key] || 0) + 1;
  }
  const keys = Object.keys(byCustomer);
  const returningCount = keys.filter((k) => byCustomer[k] > 1).length;
  const newCount = keys.length - returningCount;
  const returningRate = keys.length ? (returningCount / keys.length) * 100 : null;
  return { returningCount, newCount, returningRate, uniqueCustomers: keys.length };
};

const buildInsights = ({ current, previous, products, locations, conversionRate, customerStats }) => {
  const insights = [];
  const top = products[0];
  if (top && top.revenue > 0) {
    insights.push({
      id: 'top-product',
      title: `Sales from ${top.name}`,
      body: `${formatInsightMoney(top.revenue)} across ${top.qty} units in this period.`,
      tone: 'positive',
      href: '/staff/analytics',
    });
  }
  if (locations[0]) {
    insights.push({
      id: 'top-location',
      title: `Orders from ${locations[0].city || locations[0].label}`,
      body: `${locations[0].orders} orders · ${formatInsightMoney(locations[0].revenue)}.`,
      tone: 'info',
      href: '/staff/live',
    });
  }
  const salesChange =
    previous.totalSales === 0
      ? current.totalSales > 0
        ? 100
        : 0
      : ((current.totalSales - previous.totalSales) / Math.abs(previous.totalSales)) * 100;
  if (Math.abs(salesChange) >= 15 && current.orderCount > 0) {
    insights.push({
      id: 'sales-momentum',
      title: salesChange >= 0 ? 'Total sales accelerating' : 'Total sales cooling off',
      body: `${salesChange >= 0 ? '+' : ''}${salesChange.toFixed(0)}% vs previous period (${formatInsightMoney(previous.totalSales)} → ${formatInsightMoney(current.totalSales)}).`,
      tone: salesChange >= 0 ? 'positive' : 'warn',
      href: '/staff/analytics',
    });
  }
  if (customerStats.returningRate != null) {
    insights.push({
      id: 'returning',
      title: 'Orders from returning customers',
      body: `${customerStats.returningCount} returning · ${customerStats.newCount} new (${customerStats.returningRate.toFixed(0)}% returning).`,
      tone: 'info',
      href: '/staff/customers',
    });
  }
  if (conversionRate != null) {
    insights.push({
      id: 'conversion',
      title: 'Store conversion rate',
      body: `${conversionRate.toFixed(2)}% of tracked sessions placed an order.`,
      tone: conversionRate >= 2 ? 'positive' : 'warn',
      href: '/staff/analytics',
    });
  }
  return insights.slice(0, 5);
};

const formatInsightMoney = (n) =>
  `EGP ${Math.round(Number(n) || 0).toLocaleString('en-EG')}`;

const listCustomers = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { status: { not: 'canceled' } },
      include: {
        items: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });

    const map = {};
    for (const o of orders) {
      const key = customerKey(o) || `guest:${o.id}`;
      if (!map[key]) {
        map[key] = {
          id: key,
          name: o.user?.name || o.guestName || 'Guest',
          phone: o.user?.phone || o.guestPhone || null,
          email: o.user?.email || o.guestEmail || null,
          userId: o.userId || null,
          orders: 0,
          totalSpent: 0,
          lastOrderAt: null,
          cities: {},
          returning: false,
        };
      }
      const c = map[key];
      c.orders += 1;
      c.totalSpent += Number(o.totalPrice);
      if (!c.lastOrderAt || o.createdAt > new Date(c.lastOrderAt)) {
        c.lastOrderAt = o.createdAt;
        c.name = o.user?.name || o.guestName || c.name;
      }
      const city = o.shippingAddress?.city;
      if (city) c.cities[city] = (c.cities[city] || 0) + 1;
    }

    const customers = Object.values(map)
      .map((c) => {
        const topCity = Object.entries(c.cities).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          userId: c.userId,
          orders: c.orders,
          totalSpent: c.totalSpent,
          lastOrderAt: c.lastOrderAt,
          city: topCity,
          returning: c.orders > 1,
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);

    const returning = customers.filter((c) => c.returning).length;
    res.json({
      customers,
      summary: {
        total: customers.length,
        returning,
        new: customers.length - returning,
        returningRate: customers.length ? (returning / customers.length) * 100 : 0,
      },
    });
  } catch (err) {
    console.error('listCustomers:', err);
    res.status(500).json({ message: err.message });
  }
};

const opsCounts = async (_req, res) => {
  try {
    const [orders, abandoned, problems] = await Promise.all([
      prisma.order.findMany({
        where: { status: { not: 'canceled' } },
        select: {
          id: true,
          status: true,
          isPaid: true,
          bostaTrackingNumber: true,
          bostaDeliveryId: true,
        },
      }),
      prisma.abandonedCheckout.count({
        where: { recoveryStatus: 'not_recovered' },
      }),
      prisma.problemRequest.count({
        where: { status: { in: ['open', 'in_progress'] } },
      }),
    ]);

    const unpaid = orders.filter((o) => !o.isPaid && o.status !== 'delivered').length;
    const unfulfilled = orders.filter(
      (o) =>
        o.status !== 'delivered' &&
        !o.bostaTrackingNumber &&
        !o.bostaDeliveryId
    ).length;
    const open = orders.filter((o) =>
      ['pending', 'confirmed', 'out_for_delivery', 'problem'].includes(o.status)
    ).length;

    res.json({ unpaid, unfulfilled, open, abandoned, problems });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const activityFeed = async (_req, res) => {
  try {
    const [orders, abandoned, problems] = await Promise.all([
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: {
          user: { select: { name: true } },
          items: { take: 3, select: { name: true, qty: true } },
        },
      }),
      prisma.abandonedCheckout.findMany({
        where: { recoveryStatus: 'not_recovered' },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      prisma.problemRequest.findMany({
        where: { status: { in: ['open', 'in_progress'] } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          customer: { select: { name: true } },
          order: { select: { id: true } },
        },
      }),
    ]);

    const events = [];
    for (const o of orders) {
      events.push({
        id: `order-${o.id}`,
        type: 'order',
        title: `Order #${o.id.slice(0, 8)}`,
        body: `${o.user?.name || o.guestName || 'Guest'} · ${o.status.replace(/_/g, ' ')} · EGP ${Math.round(Number(o.totalPrice))}`,
        href: `/staff/orders/${o.id}`,
        at: o.createdAt,
      });
      if (o.isPaid && o.paidAt) {
        events.push({
          id: `paid-${o.id}`,
          type: 'payment',
          title: `Payment captured`,
          body: `#${o.id.slice(0, 8)} · EGP ${Math.round(Number(o.totalPrice))}`,
          href: `/staff/orders/${o.id}`,
          at: o.paidAt,
        });
      }
      if (o.bostaTrackingNumber) {
        events.push({
          id: `bosta-${o.id}`,
          type: 'shipping',
          title: `Bosta synced`,
          body: `${o.bostaTrackingNumber} · #${o.id.slice(0, 8)}`,
          href: `/staff/orders/${o.id}`,
          at: o.updatedAt,
        });
      }
    }
    for (const a of abandoned) {
      events.push({
        id: `abd-${a.id}`,
        type: 'abandoned',
        title: 'Abandoned checkout',
        body: `${a.guestName || a.guestPhone || a.guestEmail || 'Guest'} · EGP ${Math.round(Number(a.subtotal))}`,
        href: '/staff/abandoned',
        at: a.updatedAt,
      });
    }
    for (const p of problems) {
      events.push({
        id: `prob-${p.id}`,
        type: 'problem',
        title: p.subject,
        body: `${p.customer?.name || 'Customer'} · #${(p.order?.id || '').slice(0, 8)}`,
        href: '/staff/problems',
        at: p.createdAt,
      });
    }

    events.sort((a, b) => new Date(b.at) - new Date(a.at));
    res.json({ events: events.slice(0, 30) });
  } catch (err) {
    console.error('activityFeed:', err);
    res.status(500).json({ message: err.message });
  }
};

const inventoryReport = async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        sizeStocks: true,
        category: { select: { name: true, audience: true } },
      },
      orderBy: { name: 'asc' },
    });

    const rows = [];
    for (const p of products) {
      const sizes = p.sizeStocks || [];
      if (sizes.length) {
        for (const s of sizes) {
          rows.push({
            productId: p.id,
            name: p.name,
            size: s.size,
            stock: s.stock,
            category: p.category?.name || null,
            audience: p.category?.audience || p.audience || null,
            price: Number(p.isSaleActive && p.salePrice != null ? p.salePrice : p.price),
            low: s.stock <= 5,
            out: s.stock <= 0,
          });
        }
      } else {
        rows.push({
          productId: p.id,
          name: p.name,
          size: null,
          stock: p.stock,
          category: p.category?.name || null,
          audience: p.category?.audience || p.audience || null,
          price: Number(p.isSaleActive && p.salePrice != null ? p.salePrice : p.price),
          low: p.stock <= 5,
          out: p.stock <= 0,
        });
      }
    }

    rows.sort((a, b) => a.stock - b.stock);
    res.json({
      rows,
      summary: {
        skus: rows.length,
        lowStock: rows.filter((r) => r.low && !r.out).length,
        outOfStock: rows.filter((r) => r.out).length,
        inStock: rows.filter((r) => !r.out).length,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const integrationsStatus = async (_req, res) => {
  const paymob = require('../utils/paymob');
  const bosta = require('../utils/bosta');
  const clientUrl = process.env.CLIENT_URL || '';
  const apiUrl = process.env.API_PUBLIC_URL || '';
  res.json({
    paymobEnabled: paymob.isConfigured(),
    bostaEnabled: bosta.isConfigured(),
    mailchimpEnabled: Boolean(
      process.env.MAILCHIMP_API_KEY &&
        process.env.MAILCHIMP_AUDIENCE_ID &&
        process.env.MAILCHIMP_SERVER_PREFIX
    ),
    cloudinaryEnabled: Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    ),
    urls: {
      client: clientUrl,
      api: apiUrl,
      paymobWebhook: apiUrl ? `${apiUrl.replace(/\/$/, '')}/api/paymob/webhook` : null,
      bostaWebhook: apiUrl ? `${apiUrl.replace(/\/$/, '')}/api/bosta/webhook` : null,
    },
    currency: process.env.PAYMOB_CURRENCY || 'EGP',
  });
};

module.exports = {
  analyticsSummary,
  parseRange,
  listCustomers,
  opsCounts,
  activityFeed,
  inventoryReport,
  integrationsStatus,
};
