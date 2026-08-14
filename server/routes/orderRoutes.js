const express = require('express');
const {
  createOrder,
  createGuestOrder,
  myOrders,
  getOrder,
  listOrders,
  updateOrderStatus,
  markOrderPaid,
  deleteOrder,
  financeSummary,
} = require('../controllers/orderController');
const { protect, adminOnly, opsOrAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/guest', createGuestOrder);
router.post('/', protect, createOrder);
router.get('/mine', protect, myOrders);
router.get('/finance', protect, adminOnly, financeSummary);
router.get('/', protect, opsOrAdmin, listOrders);
router.get('/:id', protect, getOrder);
router.patch('/:id/status', protect, opsOrAdmin, updateOrderStatus);
router.patch('/:id/paid', protect, opsOrAdmin, markOrderPaid);
router.delete('/:id', protect, opsOrAdmin, deleteOrder);

module.exports = router;
