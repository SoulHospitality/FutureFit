const express = require('express');
const {
  getShippingConfig,
  getShippingAdmin,
  updateShippingAdmin,
  listFreeOffers,
  createFreeOffer,
  updateFreeOffer,
  deleteFreeOffer,
} = require('../controllers/shippingController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// Storefront
router.get('/config', getShippingConfig);

// Staff → Shipping (prices per destination)
router.get('/admin', protect, adminOnly, getShippingAdmin);
router.put('/admin', protect, adminOnly, updateShippingAdmin);

// Staff → Promotions → Free shipping
router.get('/free-offers', protect, adminOnly, listFreeOffers);
router.post('/free-offers', protect, adminOnly, createFreeOffer);
router.put('/free-offers/:id', protect, adminOnly, updateFreeOffer);
router.delete('/free-offers/:id', protect, adminOnly, deleteFreeOffer);

module.exports = router;
