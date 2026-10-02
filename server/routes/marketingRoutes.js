const express = require('express');
const {
  getPublicConfig,
  getAdminSettings,
  updateSettings,
  testMetaConnection,
  campaignReport,
  sitemap,
  robots,
  verificationFile,
  productFeed,
} = require('../controllers/marketingController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// Public — storefront config + crawler files (proxied from the storefront domain by Vercel)
router.get('/public', getPublicConfig);
router.get('/sitemap.xml', sitemap);
router.get('/robots.txt', robots);
router.get('/feed.xml', productFeed);
router.get('/verify/:name', verificationFile);

// Staff
router.get('/settings', protect, adminOnly, getAdminSettings);
router.put('/settings', protect, adminOnly, updateSettings);
router.post('/test-meta', protect, adminOnly, testMetaConnection);
router.get('/campaigns', protect, adminOnly, campaignReport);

module.exports = router;
