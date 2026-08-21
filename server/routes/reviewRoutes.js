const express = require('express');
const { listReviews, updateReview, deleteReview } = require('../controllers/reviewController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', listReviews);
router.patch('/:id', protect, adminOnly, updateReview);
router.delete('/:id', protect, adminOnly, deleteReview);

module.exports = router;
