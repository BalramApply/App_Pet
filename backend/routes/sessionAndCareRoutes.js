const express = require('express');
const {
  arriveSession,
  startSession,
  completeSession,
  interruptOrDisputeSession,
  getSessionById,
  createSessionReview,
  createVaccinationRecord,
  getPetHealthRecords,
  createSupportTicket,
  listSupportTickets,
} = require('../controllers/sessionAndCareController');
const { protect } = require('../middleware/authMiddleware');
const { getMyTicketThread, replyToMyTicket } = require('../controllers/supportThreadController');

const router = express.Router();

// Session lifecycle & wallet settlement
router.get('/sessions/:sessionId', protect, getSessionById);
router.post('/sessions/:sessionId/arrive', protect, arriveSession);
router.post('/sessions/:sessionId/start', protect, startSession);
router.post('/sessions/:sessionId/complete', protect, completeSession);
router.post('/sessions/:sessionId/interrupt', protect, interruptOrDisputeSession);

// Session-specific reviews
router.post('/sessions/:sessionId/review', protect, createSessionReview);

// Vaccination & Health Vault
router.post('/vaccinations', protect, createVaccinationRecord);
router.get('/pets/:petId/health-records', protect, getPetHealthRecords);

// Multi-channel Support & SOS
router.post('/support/tickets', protect, createSupportTicket);
router.get('/support/tickets', protect, listSupportTickets);
router.get('/support/tickets/:ticketId', protect, getMyTicketThread);
router.post('/support/tickets/:ticketId/reply', protect, replyToMyTicket);

module.exports = router;