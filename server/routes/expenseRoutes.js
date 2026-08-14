const express = require('express');
const {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} = require('../controllers/expenseController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, adminOnly, listExpenses);
router.post('/', protect, adminOnly, createExpense);
router.put('/:id', protect, adminOnly, updateExpense);
router.delete('/:id', protect, adminOnly, deleteExpense);

module.exports = router;
