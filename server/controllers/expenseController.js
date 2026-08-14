const prisma = require('../lib/prisma');

const EXPENSE_CATEGORIES = [
  'marketing',
  'shipping',
  'packaging',
  'rent',
  'salary',
  'supplies',
  'utilities',
  'other',
];

const serializeExpense = (e) => ({
  ...e,
  amount: Number(e.amount),
});

const listExpenses = async (req, res) => {
  try {
    const { from, to } = req.query;
    const expenseDate = {};
    if (from) expenseDate.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      expenseDate.lte = end;
    }

    const expenses = await prisma.expense.findMany({
      where: Object.keys(expenseDate).length ? { expenseDate } : undefined,
      orderBy: { expenseDate: 'desc' },
    });
    res.json(expenses.map(serializeExpense));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createExpense = async (req, res) => {
  try {
    const { category, description, amount, expenseDate, notes } = req.body;
    if (!category || !description || amount == null || !expenseDate) {
      return res.status(400).json({ message: 'category, description, amount, and expenseDate are required' });
    }
    if (!EXPENSE_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'Invalid category' });
    }
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }

    const expense = await prisma.expense.create({
      data: {
        category,
        description: String(description).trim(),
        amount: num,
        expenseDate: new Date(expenseDate),
        notes: notes ? String(notes).trim() : null,
        createdById: req.user?.id || null,
      },
    });
    res.status(201).json(serializeExpense(expense));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateExpense = async (req, res) => {
  try {
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Expense not found' });

    const { category, description, amount, expenseDate, notes } = req.body;
    const data = {};
    if (category != null) {
      if (!EXPENSE_CATEGORIES.includes(category)) {
        return res.status(400).json({ message: 'Invalid category' });
      }
      data.category = category;
    }
    if (description != null) data.description = String(description).trim();
    if (amount != null) {
      const num = Number(amount);
      if (!Number.isFinite(num) || num <= 0) {
        return res.status(400).json({ message: 'amount must be a positive number' });
      }
      data.amount = num;
    }
    if (expenseDate != null) data.expenseDate = new Date(expenseDate);
    if (notes !== undefined) data.notes = notes ? String(notes).trim() : null;

    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data,
    });
    res.json(serializeExpense(expense));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Expense not found' });
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ message: 'Expense deleted', id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  EXPENSE_CATEGORIES,
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
};
