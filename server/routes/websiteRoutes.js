const express = require('express');
const { getPublic, getAdmin, update } = require('../controllers/websiteController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/public', getPublic);
router.get('/', protect, adminOnly, getAdmin);
router.put('/', protect, adminOnly, update);

module.exports = router;
