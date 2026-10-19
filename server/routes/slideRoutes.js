const express = require('express');
const {
  listSlides,
  createSlide,
  updateSlide,
  deleteSlide,
  cloudinaryStatus,
} = require('../controllers/slideController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', listSlides);
router.get('/cloudinary-status', protect, adminOnly, cloudinaryStatus);
router.post('/', protect, adminOnly, createSlide);
router.put('/:id', protect, adminOnly, updateSlide);
router.delete('/:id', protect, adminOnly, deleteSlide);

module.exports = router;
