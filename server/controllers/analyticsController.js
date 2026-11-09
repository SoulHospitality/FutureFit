const prisma = require('../lib/prisma');

const DAY_MS = 86400000;
// Store's default: Cairo (UTC+2), as minutes in Date#getTimezoneOffset style
const DEFAULT_TZ_OFFSET = -120;

/** Minutes behind UTC, like the browser's getTimezoneOffset() (Cairo = -120). */
const parseTzOffset = (tz) => {
  const n = Number(tz);
  if (tz === undefined || tz === null || tz === '' || !Number.isFinite(n)) return DEFAULT_TZ_OFFSET;
  return Math.max(-840, Math.min(840, Math.round(n)));
};

/** "YYYY-MM-DD" → UTC ms of that calendar day's midnight (no tz yet). */
const dayStartUtc = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/**
 * Whole local days from..to (inclusive) in the viewer's time zone.
 * `from`/`to` are calendar dates; `tz` is minutes behind UTC.
 */
const parseRange = (from, to, tz) => {
  const offsetMs = parseTzOffset(tz) * 60000;
  const todayLocal = dayStartUtc(new Date(Date.now() - offsetMs).toISOString());
  let endDay = dayStartUtc(to) ?? todayLocal;
  let startDay = dayStartUtc(from) ?? endDay - 6 * DAY_MS;
  if (startDay > endDay) [startDay, endDay] = [endDay, startDay];
  return {
    start: new Date(startDay + offsetMs),
    end: new Date(endDay + DAY_MS + offsetMs - 1),
    offsetMs,
  };
};

const previousRange = (start, end) => {
  const ms = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - ms - 1),
    end: new Date(start.getTime() - 1),
  };
};

/** Bucket label in local time: "YYYY-MM-DDTHH:00" (hour) or "YYYY-MM-DD" (day). */
const bucketKey = (date, mode, offsetMs = 0) => {
  const local = new Date(new Date(date).getTime() - offsetMs).toISOString();
  if (mode === 'hour') return `${local.slice(0, 13)}:00`;
  if (mode === 'month') return local.slice(0, 7);
  return local.slice(0, 10);
};

const buildBuckets = (start, end, mode, offsetMs = 0) => {
  const keys = [];
  const step = mode === 'hour' ? 3600000 : DAY_MS;
  for (let t = start.getTime(); t <= end.getTime(); t += step) {
    const key = bucketKey(t, mode, offsetMs);
    if (keys[keys.length - 1] !== key) keys.push(key);
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

const seriesFromOrders = (orders, start, end, mode, offsetMs = 0) => {
  const keys = buildBuckets(start, end, mode, offsetMs);
  const map = Object.fromEntries(keys.map((k) => [k, { value: 0, count: 0 }]));
  for (const o of orders) {
    if (o.status === 'canceled') continue;
    const k = bucketKey(o.createdAt, mode, offsetMs);
    if (!map[k]) continue;
    map[k].value += Number(o.totalPrice);
    map[k].count += 1;
  }
  return keys.map((label) => ({ label, ...map[label] }));
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
    // "All time": start on the local day of the first recorded order or session.
    const allTime = ['1', 'true'].includes(String(req.query.all || '').toLowerCase());
    let from = req.query.from;
    if (allTime) {
      const tzMs = parseTzOffset(req.query.tz) * 60000;
      const [firstOrder, firstSession] = await Promise.all([
        prisma.order.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
        prisma.storePresence.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      ]);
      const firstMs = Math.min(
        firstOrder?.createdAt?.getTime() ?? Infinity,
        firstSession?.createdAt?.getTime() ?? Infinity,
      );
      from = Number.isFinite(firstMs)
        ? new Date(firstMs - tzMs).toISOString().slice(0, 10)
        : req.query.to;
    }
    const { start, end, offsetMs } = parseRange(from, req.query.to, req.query.tz);
    // Nothing comes before "all time", so there is no comparison period.
    const prev = allTime ? null : previousRange(start, end);
    const spanHours = (end - start) / 3600000;
    const mode = spanHours <= 48 ? 'hour' : spanHours <= 92 * 24 ? 'day' : 'month';

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
      prev
        ? prisma.order.findMany({
            where: { createdAt: { gte: prev.start, lte: prev.end } },
            include,
            orderBy: { createdAt: 'asc' },
          })
        : [],
      prisma.storePresence.count({
        where: { createdAt: { gte: start, lte: end } },
      }),
      prev
        ? prisma.storePresence.count({
            where: { createdAt: { gte: prev.start, lte: prev.end } },
          })
        : 0,
    ]);

    const current = summarizeOrders(orders);
    const previous = summarizeOrders(prevOrders);
    const pct = (a, b) => {
      if (!prev) return null;
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
      previous: prev ? previous : null,
      products,
      locations,
      conversionRate,
      customerStats,
    });

    res.json({
      range: { from: start.toISOString(), to: end.toISOString(), mode, all: allTime },
      compareRange: prev ? { from: prev.start.toISOString(), to: prev.end.toISOString() } : null,
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
        current: seriesFromOrders(orders, start, end, mode, offsetMs),
        previous: prev ? seriesFromOrders(prevOrders, prev.start, prev.end, mode, offsetMs) : [],
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
  const salesChange = !previous
    ? 0
    : previous.totalSales === 0
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

const FORECAST_WINDOWS = [7, 14, 30, 60, 90];
const SOON_DAYS = 14;
const norm = (v) => String(v || '').trim().toLowerCase();

/**
 * Units sold per SKU over the last `days` (canceled orders excluded).
 * Keyed by product, then "color|size", so rows can match exactly or fall back.
 */
const salesBySku = async (since) => {
  const items = await prisma.orderItem.findMany({
    where: {
      productId: { not: null },
      order: { createdAt: { gte: since }, status: { not: 'canceled' } },
    },
    select: { productId: true, color: true, size: true, qty: true },
  });
  const byProduct = new Map();
  for (const it of items) {
    const qty = Math.max(0, Number(it.qty) || 0);
    if (!qty) continue;
    if (!byProduct.has(it.productId)) byProduct.set(it.productId, { total: 0, keys: new Map() });
    const entry = byProduct.get(it.productId);
    entry.total += qty;
    const key = `${norm(it.color)}|${norm(it.size)}`;
    entry.keys.set(key, (entry.keys.get(key) || 0) + qty);
  }
  return byProduct;
};

/** Units of this row sold: exact color+size match, else size-only / color-only, else the whole product when it is a single SKU. */
const unitsForRow = (row, entry, rowCount) => {
  if (!entry) return 0;
  if (rowCount === 1) return entry.total;
  const color = norm(row.color);
  const size = norm(row.size);
  let units = 0;
  for (const [key, qty] of entry.keys) {
    const [c, z] = key.split('|');
    const colorOk = !color || !c || c === color;
    const sizeOk = !size || !z || z === size;
    if (colorOk && sizeOk) units += qty;
  }
  return units;
};

const inventoryReport = async (req, res) => {
  try {
    const requested = Number(req.query.days);
    const windowDays = FORECAST_WINDOWS.includes(requested) ? requested : 30;
    const now = Date.now();
    const since = new Date(now - windowDays * DAY_MS);
    const salesPromise = salesBySku(since);
    const products = await prisma.product.findMany({
      include: {
        variants: { orderBy: { sortOrder: 'asc' } },
        sizeStocks: true,
        category: { select: { name: true, audience: true } },
      },
      orderBy: { name: 'asc' },
    });

    const rows = [];
    for (const p of products) {
      const children = p.variants || [];
      const parentPrice = Number(
        p.isSaleActive && p.salePrice != null ? p.salePrice : p.price
      );
      if (children.length) {
        for (const v of children) {
          const price =
            v.price != null
              ? Number(v.price)
              : parentPrice;
          rows.push({
            productId: p.id,
            variantId: v.id,
            itemCode: v.itemCode,
            parentItemCode: p.itemCode || null,
            name: p.name,
            color: v.color,
            size: v.size,
            stock: v.stock,
            category: p.category?.name || null,
            audience: p.category?.audience || p.audience || null,
            price,
            low: v.stock <= 5,
            out: v.stock <= 0,
          });
        }
        continue;
      }
      const sizes = p.sizeStocks || [];
      if (sizes.length) {
        for (const s of sizes) {
          rows.push({
            productId: p.id,
            variantId: null,
            itemCode: p.itemCode || null,
            parentItemCode: null,
            name: p.name,
            color: null,
            size: s.size,
            stock: s.stock,
            category: p.category?.name || null,
            audience: p.category?.audience || p.audience || null,
            price: parentPrice,
            low: s.stock <= 5,
            out: s.stock <= 0,
          });
        }
      } else {
        rows.push({
          productId: p.id,
          variantId: null,
          itemCode: p.itemCode || null,
          parentItemCode: null,
          name: p.name,
          color: null,
          size: null,
          stock: p.stock,
          category: p.category?.name || null,
          audience: p.category?.audience || p.audience || null,
          price: parentPrice,
          low: p.stock <= 5,
          out: p.stock <= 0,
        });
      }
    }

    // Forecast: recent daily sales rate → days until each SKU runs out
    const sales = await salesPromise;
    const rowCounts = rows.reduce((m, r) => m.set(r.productId, (m.get(r.productId) || 0) + 1), new Map());
    const createdAt = new Map(products.map((p) => [p.id, p.createdAt]));
    for (const r of rows) {
      const sold = unitsForRow(r, sales.get(r.productId), rowCounts.get(r.productId));
      // New products haven't been on sale for the whole window — don't dilute their rate
      const ageDays = Math.max(1, (now - new Date(createdAt.get(r.productId) || since).getTime()) / DAY_MS);
      const activeDays = Math.min(windowDays, ageDays);
      const perDay = sold / activeDays;
      const stock = Math.max(0, Number(r.stock) || 0);
      const daysLeft = r.out ? 0 : perDay > 0 ? stock / perDay : null;
      r.sold = sold;
      r.perDay = Math.round(perDay * 100) / 100;
      r.perWeek = Math.round(perDay * 7 * 10) / 10;
      r.daysLeft = daysLeft == null ? null : Math.round(daysLeft * 10) / 10;
      r.stockoutDate = daysLeft == null ? null : new Date(now + daysLeft * DAY_MS).toISOString();
      // Stock to hold 30 days of sales at this pace
      r.reorderQty = perDay > 0 ? Math.max(0, Math.ceil(perDay * 30 - stock)) : 0;
      r.soon = !r.out && daysLeft != null && daysLeft <= SOON_DAYS;
    }

    rows.sort((a, b) => a.stock - b.stock);
    const bestSellers = rows
      .filter((r) => r.sold > 0)
      .sort((a, b) => b.sold - a.sold || (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9))
      .slice(0, 15);
    const runningOut = rows
      .filter((r) => r.soon)
      .sort((a, b) => a.daysLeft - b.daysLeft || b.sold - a.sold);
    const outOfStock = rows
      .filter((r) => r.out)
      .sort((a, b) => b.sold - a.sold);

    res.json({
      rows,
      forecast: {
        windowDays,
        soonDays: SOON_DAYS,
        windows: FORECAST_WINDOWS,
        bestSellers,
        runningOut,
        outOfStock,
      },
      summary: {
        skus: rows.length,
        lowStock: rows.filter((r) => r.low && !r.out).length,
        outOfStock: rows.filter((r) => r.out).length,
        inStock: rows.filter((r) => !r.out).length,
        runningOutSoon: runningOut.length,
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
