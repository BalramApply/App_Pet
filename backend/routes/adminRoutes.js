const express = require('express');
const {
  getDashboardStats,
  adminListUsers,
  adminGetUser,
  adminCreateStaff,
  adminUpdateUser,
  adminResetPassword,
} = require('../controllers/adminUserController');
const {
  adminListProfessionals,
  adminGetProfessional,
  adminSetVerification,
  adminSetCredentialVerified,
  adminSetAvailability,
  adminListExpiringCredentials,
  adminExpireOverdueProfessionals,
} = require('../controllers/adminProfessionalController');
const {
  adminListServices,
  adminCreateService,
  adminUpdateService,
  adminListPackages,
  adminCreatePackage,
  adminUpdatePackage,
} = require('../controllers/adminCatalogController');
const {
  adminListBookings,
  adminGetBooking,
  adminReassignBooking,
  adminRescheduleBooking,
  adminCreateMakeUpBooking,
  adminListSessions,
  adminGetSession,
  adminRescheduleSession,
  adminResolveSession,
  adminRetrySettlement,
  adminOpsQueue,
} = require('../controllers/adminBookingController');
const {
  adminListTickets,
  adminGetTicket,
  adminUpdateTicket,
  adminAddTicketMessage,
} = require('../controllers/adminSupportController');
const {
  adminListReviews,
  adminModerateReview,
  adminRecalculateRatings,
  adminListPets,
  adminGetPet,
  adminListVaccinations,
  adminCreateVaccination,
  adminUpdateVaccination,
} = require('../controllers/adminRecordsController');
const {
  adminGetSettings,
  adminUpdateSettings,
  adminListAuditLogs,
} = require('../controllers/adminSettingsController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { adminAudit } = require('../middleware/adminAudit');

const router = express.Router();

// Everything in this router is admin-only, and every admin write is logged.
// The audit middleware also covers the older /api/admin/* routes mounted after this router.
router.use(protect, authorizeRoles('admin'), adminAudit);

// Dashboard
router.get('/dashboard/stats', getDashboardStats);

// Users & staff (step 1)
router.get('/users', adminListUsers);
router.get('/users/:userId', adminGetUser);
router.put('/users/:userId', adminUpdateUser);
router.post('/users/:userId/reset-password', adminResetPassword);
router.post('/staff', adminCreateStaff);

// Professionals & verification (step 2)
// Fixed paths must come before the :profileId routes
router.get('/professionals', adminListProfessionals);
router.get('/professionals/expiring', adminListExpiringCredentials);
router.post('/professionals/expire-overdue', adminExpireOverdueProfessionals);
router.get('/professionals/:profileId', adminGetProfessional);
router.put('/professionals/:profileId/verification', adminSetVerification);
router.put('/professionals/:profileId/credentials/:credentialId', adminSetCredentialVerified);
router.put('/professionals/:profileId/availability', adminSetAvailability);

// Catalog (step 2)
router.get('/catalog/services', adminListServices);
router.post('/catalog/services', adminCreateService);
router.put('/catalog/services/:serviceId', adminUpdateService);
router.get('/catalog/packages', adminListPackages);
router.post('/catalog/packages', adminCreatePackage);
router.put('/catalog/packages/:packageId', adminUpdatePackage);

// Operations queue & bookings (step 3)
// Cancelling a booking as admin: use the existing POST /api/bookings/:id/cancel
router.get('/ops/attention', adminOpsQueue);
router.get('/bookings', adminListBookings);
router.get('/bookings/:id', adminGetBooking);
router.post('/bookings/:id/reassign', adminReassignBooking);
router.post('/bookings/:id/reschedule', adminRescheduleBooking);
router.post('/bookings/:id/make-up', adminCreateMakeUpBooking);

// Sessions (step 3)
router.get('/sessions', adminListSessions);
router.get('/sessions/:sessionId', adminGetSession);
router.put('/sessions/:sessionId/schedule', adminRescheduleSession);
router.post('/sessions/:sessionId/resolve', adminResolveSession);
router.post('/sessions/:sessionId/retry-settlement', adminRetrySettlement);

// Support tickets (step 4)
router.get('/support/tickets', adminListTickets);
router.get('/support/tickets/:ticketId', adminGetTicket);
router.put('/support/tickets/:ticketId', adminUpdateTicket);
router.post('/support/tickets/:ticketId/messages', adminAddTicketMessage);

// Review moderation (step 4)
router.get('/reviews', adminListReviews);
router.post('/reviews/recalculate', adminRecalculateRatings);
router.put('/reviews/:reviewId/moderation', adminModerateReview);

// Pets & vaccinations (step 4)
router.get('/pets', adminListPets);
router.get('/pets/:petId', adminGetPet);
router.get('/vaccinations', adminListVaccinations);
router.post('/vaccinations', adminCreateVaccination);
router.put('/vaccinations/:recordId', adminUpdateVaccination);

// Settings & audit log (step 4)
router.get('/settings', adminGetSettings);
router.put('/settings', adminUpdateSettings);
router.get('/audit-logs', adminListAuditLogs);

module.exports = router;