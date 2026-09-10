const express = require('express');
const {
  analyticsSummary,
  listCustomers,
  opsCounts,
  activityFeed,
  inventoryReport,
  integrationsStatus,
} = require('../controllers/analyticsController');
const { liveView, pingPresence } = require('../controllers/liveController');
const {
  upsertAbandoned,
  completeAbandoned,
  listAbandoned,
  markRecovered,
  deleteAbandoned,
} = require('../controllers/abandonedController');
const { protect, adminOnly, opsOrAdmin, optionalProtect } = require('../middleware/authMiddleware');

const router = express.Router();

// Public storefront beacons
router.post('/presence', pingPresence);
router.post('/abandoned', optionalProtect, upsertAbandoned);
router.post('/abandoned/complete', completeAbandoned);

// Staff
router.get('/summary', protect, adminOnly, analyticsSummary);
router.get('/live', protect, opsOrAdmin, liveView);
router.get('/customers', protect, opsOrAdmin, listCustomers);
router.get('/ops-counts', protect, opsOrAdmin, opsCounts);
router.get('/activity', protect, opsOrAdmin, activityFeed);
router.get('/inventory', protect, adminOnly, inventoryReport);
router.get('/integrations', protect, opsOrAdmin, integrationsStatus);
router.get('/abandoned', protect, opsOrAdmin, listAbandoned);
router.patch('/abandoned/:id/recovered', protect, opsOrAdmin, markRecovered);
router.delete('/abandoned/:id', protect, opsOrAdmin, deleteAbandoned);

module.exports = router;
