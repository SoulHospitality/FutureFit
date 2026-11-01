const express = require('express');
const { createShipment, listOrderDistricts, handleWebhook } = require('../controllers/bostaController');
const { protect, opsOrAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/webhook', handleWebhook);
router.get('/orders/:id/districts', protect, opsOrAdmin, listOrderDistricts);
router.post('/orders/:id/ship', protect, opsOrAdmin, createShipment);

module.exports = router;
