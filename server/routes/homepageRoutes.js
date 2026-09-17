const express = require('express');
const {
  getHomepage,
  getHomepageAdmin,
  putHomepage,
} = require('../controllers/homepageController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', getHomepage);
router.get('/admin', protect, adminOnly, getHomepageAdmin);
router.put('/', protect, adminOnly, putHomepage);

module.exports = router;
