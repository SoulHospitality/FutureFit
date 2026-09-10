const prisma = require('../lib/prisma');

const listProblems = async (req, res) => {
  try {
    const problems = await prisma.problemRequest.findMany({
      include: {
        order: { select: { id: true, status: true, totalPrice: true } },
        customer: { select: { id: true, name: true, email: true, phone: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      problems.map((p) => ({
        ...p,
        order: p.order
          ? { ...p.order, totalPrice: Number(p.order.totalPrice) }
          : p.order,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createProblem = async (req, res) => {
  try {
    const { orderId, subject, details } = req.body;
    if (!orderId || !subject || !details) {
      return res.status(400).json({ message: 'orderId, subject, and details required' });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const problem = await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'problem' },
      });
      return tx.problemRequest.create({
        data: {
          orderId,
          // Guest checkouts have no user — attribute to staff creator for the relation
          customerId: order.userId || req.user.id,
          createdById: req.user.id,
          subject,
          details,
        },
        include: {
          order: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
          createdBy: { select: { id: true, name: true, role: true } },
        },
      });
    });

    res.status(201).json(problem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProblem = async (req, res) => {
  try {
    const { status, resolution, subject, details } = req.body;
    const problem = await prisma.problemRequest.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(resolution !== undefined && { resolution }),
        ...(subject && { subject }),
        ...(details && { details }),
      },
      include: {
        order: true,
        customer: { select: { id: true, name: true, email: true, phone: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });
    res.json(problem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { listProblems, createProblem, updateProblem };
