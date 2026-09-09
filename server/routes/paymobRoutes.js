const express = require('express');
const { handleWebhook, paymentConfig } = require('../controllers/paymobController');

const router = express.Router();

router.get('/config', paymentConfig);
router.post('/webhook', handleWebhook);

module.exports = router;
