const express = require('express');
const { handleWebhook, paymentConfig } = require('../controllers/paymobController');

const router = express.Router();

router.get('/config', paymentConfig);
router.post('/webhook', handleWebhook);
// Some Paymob callback modes hit the notification URL with GET + query params
router.get('/webhook', (req, res) => {
  const obj = { ...req.query };
  delete obj.hmac;
  req.body = { obj };
  return handleWebhook(req, res);
});

module.exports = router;
