const express = require('express');
const {
  listOffers,
  publicOffers,
  createOffer,
  updateOffer,
  deleteOffer,
} = require('../controllers/offerController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/active', publicOffers);
router.get('/', protect, adminOnly, listOffers);
router.post('/', protect, adminOnly, createOffer);
router.put('/:id', protect, adminOnly, updateOffer);
router.delete('/:id', protect, adminOnly, deleteOffer);

module.exports = router;
