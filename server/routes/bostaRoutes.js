const express = require('express');
const { createShipment, handleWebhook } = require('../controllers/bostaController');
const { protect, opsOrAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/webhook', handleWebhook);
router.post('/orders/:id/ship', protect, opsOrAdmin, createShipment);

module.exports = router;
