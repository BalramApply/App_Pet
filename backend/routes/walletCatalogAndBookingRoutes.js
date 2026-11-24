const express = require('express');
const {
  getMyWalletBalance,
  getMyWalletTransactions,
  adminCreditWallet,
  adminListWalletTransactions,
  // adminListUsers,
  // adminUpdateUser,
  // adminUpdateAppConfig,
  listServices,
  listPackages,
  // createService,
  // createPackage,
} = require('../controllers/walletAndCatalogController');
const {
  bookAssessment,
  createBooking,
  getBookings,
  getBookingById,
  cancelBooking,
} = require('../controllers/bookingController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// Wallet endpoints (Clients & Professionals)
router.get('/wallet/balance', protect, getMyWalletBalance);
router.get('/wallet/transactions', protect, getMyWalletTransactions);

// Catalog endpoints
router.get('/services', protect, listServices);
router.get('/packages', protect, listPackages);

// Booking endpoints
router.post('/bookings/assessment', protect, bookAssessment);
router.post('/bookings/create', protect, createBooking);
router.get('/bookings', protect, getBookings);
router.get('/bookings/:id', protect, getBookingById);
router.post('/bookings/:id/cancel', protect, cancelBooking);

// Admin endpoints (Wallet top-ups, ledger, users, catalog, app config)
router.post('/admin/wallet/credit', protect, authorizeRoles('admin'), adminCreditWallet);
router.get(
  '/admin/wallet/transactions',
  protect,
  authorizeRoles('admin'),
  adminListWalletTransactions
);
// router.get('/admin/users', protect, authorizeRoles('admin'), adminListUsers);
// router.put('/admin/users/:userId', protect, authorizeRoles('admin'), adminUpdateUser);
// router.put('/admin/config', protect, authorizeRoles('admin'), adminUpdateAppConfig);
// router.post('/admin/services', protect, authorizeRoles('admin'), createService);
// router.post('/admin/packages', protect, authorizeRoles('admin'), createPackage);

module.exports = router;