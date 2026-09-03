const express = require('express');
const { subscribe, listSubscribers } = require('../controllers/newsletterController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', subscribe);
router.get('/', protect, adminOnly, listSubscribers);

module.exports = router;
