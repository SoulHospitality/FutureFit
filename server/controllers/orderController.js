const prisma = require('../lib/prisma');
const cache = require('../lib/cache');

const FREE_SHIPPING_MIN = 2000;
const SHIPPING_FEE = 75;

const effectivePrice = (product) => {
  if (product.isSaleActive && product.salePrice != null) {
    return Number(product.salePrice);
  }
  return Number(product.price);
};

const normalizePhone = (phone) => String(phone || '').replace(/\s+/g, '').trim();

const buildOrderItems = async (orderItems) => {
  if (!orderItems?.length) {
    const err = new Error('No order items');
    err.status = 400;
    throw err;
  }

  const productIds = orderItems.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));

  let itemsPrice = 0;
  const itemsData = [];

  for (const item of orderItems) {
    const product = byId[item.productId];
    if (!product) {
      const err = new Error(`Product not found: ${item.productId}`);
      err.status = 400;
      throw err;
    }
    const qty = Number(item.qty) || 0;
    if (qty < 1) {
      const err = new Error(`Invalid quantity for ${product.name}`);
      err.status = 400;
      throw err;
    }
    if (product.stock < qty) {
      const err = new Error(`Insufficient stock for ${product.name}`);
      err.status = 400;
      throw err;
    }
    const price = effectivePrice(product);
    itemsPrice += price * qty;
    itemsData.push({
      productId: product.id,
      name: product.name,
      qty,
      image: product.photos[0] || '',
      price,
      color: item.color || null,
      size: item.size || null,
    });
  }

  return { itemsPrice, itemsData };
};

const resolveCoupon = async (couponCode, itemsPrice) => {
  let discountAmount = 0;
  let couponId = null;
  let savedCouponCode = null;
  if (!couponCode) {
    return { discountAmount, couponId, savedCouponCode };
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code: String(couponCode).toUpperCase() },
  });
  if (!coupon || !coupon.isActive) {
    const err = new Error('Invalid coupon');
    err.status = 400;
    throw err;
  }
  discountAmount = (itemsPrice * coupon.discountPercentage) / 100;
  couponId = coupon.id;
  savedCouponCode = coupon.code;
  return { discountAmount, couponId, savedCouponCode };
};

const persistOrder = async ({
  userId = null,
  guestName = null,
  guestPhone = null,
  guestEmail = null,
  paymentMethod,
  shippingAddress,
  itemsData,
  itemsPrice,
  shippingPrice,
  discountAmount,
  totalPrice,
  couponId,
  savedCouponCode,
}) => {
  const order = await prisma.$transaction(async (tx) => {
    for (const item of itemsData) {
      const updated = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.qty } },
        data: { stock: { decrement: item.qty } },
      });
      if (updated.count === 0) {
        throw new Error(`Insufficient stock for ${item.name}`);
      }
    }

    return tx.order.create({
      data: {
        userId,
        guestName,
        guestPhone,
        guestEmail,
        paymentMethod,
        shippingAddress,
        itemsPrice,
        shippingPrice,
        discountAmount,
        totalPrice,
        couponId,
        couponCode: savedCouponCode,
        items: { create: itemsData },
      },
      include: {
        items: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
  });

  cache.invalidate('products');
  cache.invalidate('product');
  return order;
};

const createOrder = async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ message: 'Only customers can place orders' });
    }

    const { orderItems, paymentMethod, shippingAddress, couponCode } = req.body;
    if (!paymentMethod || !shippingAddress) {
      return res.status(400).json({ message: 'Payment method and shipping address required' });
    }

    const { itemsPrice, itemsData } = await buildOrderItems(orderItems);
    const { discountAmount, couponId, savedCouponCode } = await resolveCoupon(
      couponCode,
      itemsPrice
    );
    const shippingPrice = itemsPrice >= FREE_SHIPPING_MIN ? 0 : SHIPPING_FEE;
    const totalPrice = Math.max(0, itemsPrice + shippingPrice - discountAmount);

    const order = await persistOrder({
      userId: req.user.id,
      paymentMethod,
      shippingAddress,
      itemsData,
      itemsPrice,
      shippingPrice,
      discountAmount,
      totalPrice,
      couponId,
      savedCouponCode,
    });

    res.status(201).json(serializeOrder(order));
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.message?.startsWith('Insufficient stock')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

const createGuestOrder = async (req, res) => {
  try {
    const {
      orderItems,
      paymentMethod,
      shippingAddress,
      couponCode,
      guestName,
      guestPhone,
      guestEmail,
    } = req.body;

    const name = String(guestName || '').trim();
    const phone = normalizePhone(guestPhone);
    const email = guestEmail ? String(guestEmail).trim().toLowerCase() : null;

    if (!name || !phone) {
      return res.status(400).json({ message: 'Name and phone are required' });
    }
    if (!paymentMethod || !shippingAddress) {
      return res.status(400).json({ message: 'Payment method and shipping address required' });
    }
    if (!shippingAddress.street || !shippingAddress.city) {
      return res.status(400).json({ message: 'Street and city are required' });
    }

    const { itemsPrice, itemsData } = await buildOrderItems(orderItems);
    const { discountAmount, couponId, savedCouponCode } = await resolveCoupon(
      couponCode,
      itemsPrice
    );
    const shippingPrice = itemsPrice >= FREE_SHIPPING_MIN ? 0 : SHIPPING_FEE;
    const totalPrice = Math.max(0, itemsPrice + shippingPrice - discountAmount);

    const order = await persistOrder({
      userId: null,
      guestName: name,
      guestPhone: phone,
      guestEmail: email,
      paymentMethod,
      shippingAddress,
      itemsData,
      itemsPrice,
      shippingPrice,
      discountAmount,
      totalPrice,
      couponId,
      savedCouponCode,
    });

    res.status(201).json(serializeOrder(order));
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.message?.startsWith('Insufficient stock')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

const serializeOrder = (order) => ({
  ...order,
  itemsPrice: Number(order.itemsPrice),
  shippingPrice: Number(order.shippingPrice),
  discountAmount: Number(order.discountAmount),
  totalPrice: Number(order.totalPrice),
  items: order.items?.map((i) => ({ ...i, price: Number(i.price) })),
  customerName: order.user?.name || order.guestName || null,
  customerPhone: order.user?.phone || order.guestPhone || null,
  customerEmail: order.user?.email || order.guestEmail || null,
});

const myOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders.map(serializeOrder));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getOrder = async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
        problems: true,
      },
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const isOwner = order.userId && order.userId === req.user.id;
    const isStaff = ['admin', 'ops'].includes(req.user.role);
    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    res.json(serializeOrder(order));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const listOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const orders = await prisma.order.findMany({
      where: status ? { status } : undefined,
      include: {
        items: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders.map(serializeOrder));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = [
      'pending',
      'confirmed',
      'out_for_delivery',
      'delivered',
      'canceled',
      'problem',
    ];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const data = { status };
    if (status === 'delivered') {
      data.deliveredAt = new Date();
      data.isPaid = true;
      data.paidAt = new Date();
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data,
      include: {
        items: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    res.json(serializeOrder(order));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const existing = await prisma.order.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ message: 'Order not found' });

    await prisma.$transaction(async (tx) => {
      await tx.problemRequest.deleteMany({ where: { orderId: req.params.id } });
      await tx.orderItem.deleteMany({ where: { orderId: req.params.id } });
      await tx.order.delete({ where: { id: req.params.id } });
    });

    res.json({ message: 'Order deleted', id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const markOrderPaid = async (req, res) => {
  try {
    const existing = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    if (!existing) return res.status(404).json({ message: 'Order not found' });
    if (existing.status === 'canceled') {
      return res.status(400).json({ message: 'Cannot mark a canceled order as paid' });
    }
    if (existing.isPaid) {
      return res.json(serializeOrder(existing));
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { isPaid: true, paidAt: new Date() },
      include: {
        items: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    res.json(serializeOrder(order));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const endOfDay = (to) => {
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  return end;
};

const financeSummary = async (req, res) => {
  try {
    const { from, to } = req.query;
    const createdAt = {};
    if (from) createdAt.gte = new Date(from);
    if (to) createdAt.lte = endOfDay(to);

    const where = {
      status: { not: 'canceled' },
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    };

    const expenseDate = {};
    if (from) expenseDate.gte = new Date(from);
    if (to) expenseDate.lte = endOfDay(to);

    const [orders, expenses, lowStock] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.expense.findMany({
        where: Object.keys(expenseDate).length ? { expenseDate } : undefined,
        orderBy: { expenseDate: 'desc' },
      }),
      prisma.product.findMany({
        where: { stock: { lte: 5 } },
        orderBy: { stock: 'asc' },
        take: 10,
      }),
    ]);

    const revenue = orders.reduce((sum, o) => sum + Number(o.totalPrice), 0);
    const paid = orders.filter((o) => o.isPaid).reduce((sum, o) => sum + Number(o.totalPrice), 0);
    const outstanding = revenue - paid;
    const itemsTotal = orders.reduce((sum, o) => sum + Number(o.itemsPrice), 0);
    const shippingTotal = orders.reduce((sum, o) => sum + Number(o.shippingPrice), 0);
    const discountTotal = orders.reduce((sum, o) => sum + Number(o.discountAmount), 0);

    const byStatus = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    const methodMap = {};
    for (const o of orders) {
      const method = o.paymentMethod || 'Other';
      if (!methodMap[method]) {
        methodMap[method] = { method, count: 0, revenue: 0, paid: 0, outstanding: 0 };
      }
      const total = Number(o.totalPrice);
      methodMap[method].count += 1;
      methodMap[method].revenue += total;
      if (o.isPaid) methodMap[method].paid += total;
      else methodMap[method].outstanding += total;
    }
    const byPaymentMethod = Object.values(methodMap).sort((a, b) => b.revenue - a.revenue);

    const expensesTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const categoryMap = {};
    for (const e of expenses) {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + Number(e.amount);
    }
    const byExpenseCategory = Object.entries(categoryMap)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    res.json({
      orderCount: orders.length,
      revenue,
      paid,
      outstanding,
      itemsTotal,
      shippingTotal,
      discountTotal,
      byStatus,
      byPaymentMethod,
      expensesTotal,
      expenseCount: expenses.length,
      netCash: paid - expensesTotal,
      byExpenseCategory,
      expenses: expenses.map((e) => ({ ...e, amount: Number(e.amount) })),
      orders: orders.map(serializeOrder),
      lowStock: lowStock.map((p) => ({
        ...p,
        price: Number(p.price),
        salePrice: p.salePrice != null ? Number(p.salePrice) : null,
      })),
      recentOrders: orders.slice(0, 10).map(serializeOrder),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createOrder,
  createGuestOrder,
  myOrders,
  getOrder,
  listOrders,
  updateOrderStatus,
  markOrderPaid,
  deleteOrder,
  financeSummary,
};
