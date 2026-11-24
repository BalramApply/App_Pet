const mongoose = require('mongoose');
const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');

const TICKET_STATUSES = ['open', 'in_review', 'resolved', 'closed'];
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const TICKET_TYPES = [
  'callback_request',
  'email_inquiry',
  'complaint',
  'reschedule_request',
  'wallet_billing_inquiry',
  'concern_report',
  'emergency_sos',
];
const OPEN_STATUSES = ['open', 'in_review'];

const httpError = (statusCode, message, code) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const assertValidId = (id, label = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw httpError(400, `Invalid ${label}.`, 'INVALID_ID');
  }
};

const oid = (id) => new mongoose.Types.ObjectId(id);

// Ticket inbox. sort=queue puts critical (SOS) first, then oldest first within a priority.
const adminListTickets = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const match = {};

    if (req.query.status) {
      if (!TICKET_STATUSES.includes(req.query.status)) {
        throw httpError(400, `status must be one of: ${TICKET_STATUSES.join(', ')}.`);
      }
      match.status = req.query.status;
    } else if (req.query.openOnly === 'true') {
      match.status = { $in: OPEN_STATUSES };
    }

    if (req.query.priority) {
      if (!TICKET_PRIORITIES.includes(req.query.priority)) {
        throw httpError(400, `priority must be one of: ${TICKET_PRIORITIES.join(', ')}.`);
      }
      match.priority = req.query.priority;
    }

    if (req.query.sos === 'true') {
      match.type = 'emergency_sos';
    } else if (req.query.type) {
      if (!TICKET_TYPES.includes(req.query.type)) {
        throw httpError(400, `type must be one of: ${TICKET_TYPES.join(', ')}.`);
      }
      match.type = req.query.type;
    }

    if (req.query.unassigned === 'true') {
      match.assignedRelationshipManager = null;
    } else if (req.query.assignedTo) {
      assertValidId(req.query.assignedTo, 'assignedTo');
      match.assignedRelationshipManager = oid(req.query.assignedTo);
    }

    if (req.query.userId) {
      assertValidId(req.query.userId, 'userId');
      match.user = oid(req.query.userId);
    }

    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
      match.$or = [{ ticketNumber: rx }, { subject: rx }, { notes: rx }];
    }

    const sortStage =
      req.query.sort === 'oldest'
        ? { createdAt: 1 }
        : req.query.sort === 'queue'
          ? { priorityRank: 1, createdAt: 1 }
          : { createdAt: -1 };

    const [rows, total, openByPriority, openSos] = await Promise.all([
      SupportTicket.aggregate([
        { $match: match },
        {
          $addFields: {
            priorityRank: {
              $switch: {
                branches: [
                  { case: { $eq: ['$priority', 'critical'] }, then: 0 },
                  { case: { $eq: ['$priority', 'high'] }, then: 1 },
                  { case: { $eq: ['$priority', 'medium'] }, then: 2 },
                  { case: { $eq: ['$priority', 'low'] }, then: 3 },
                ],
                default: 4,
              },
            },
          },
        },
        { $addFields: { messageCount: { $size: { $ifNull: ['$messages', []] } } } },
        { $sort: sortStage },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $project: { messages: 0 } },
      ]),
      SupportTicket.countDocuments(match),
      SupportTicket.aggregate([
        { $match: { status: { $in: OPEN_STATUSES } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      SupportTicket.countDocuments({ type: 'emergency_sos', status: { $in: OPEN_STATUSES } }),
    ]);

    const tickets = await SupportTicket.populate(rows, [
      { path: 'user', select: 'name phone' },
      { path: 'assignedRelationshipManager', select: 'name phone' },
      { path: 'professional', select: 'name phone role' },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        tickets,
        summary: {
          openByPriority: openByPriority.reduce((acc, r) => {
            acc[r._id] = r.count;
            return acc;
          }, {}),
          openSos,
        },
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    return next(err);
  }
};

const adminGetTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    assertValidId(ticketId, 'ticketId');

    const ticket = await SupportTicket.findById(ticketId)
      .select('+messages')
      .populate('messages.author', 'name role')
      .populate('user', 'name phone email role walletBalance accountStatus')
      .populate('assignedRelationshipManager', 'name phone')
      .populate('professional', 'name phone role')
      .populate({
        path: 'booking',
        select: 'bookingType status scheduledDate timeSlot service',
        populate: { path: 'service', select: 'type title' },
      })
      .populate('session', 'sessionNumber status scheduledDate latestLocation')
      .populate('resolution.resolvedBy', 'name role')
      .lean();
    if (!ticket) throw httpError(404, 'Ticket not found.');

    return res.status(200).json({ success: true, data: { ticket } });
  } catch (err) {
    return next(err);
  }
};

// Change status, priority, assignee and resolution in one call
const adminUpdateTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    assertValidId(ticketId, 'ticketId');
    const { status, priority, assignedRelationshipManager, resolutionSummary } = req.body;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) throw httpError(404, 'Ticket not found.');

    if (priority !== undefined) {
      if (!TICKET_PRIORITIES.includes(priority)) {
        throw httpError(400, `priority must be one of: ${TICKET_PRIORITIES.join(', ')}.`);
      }
      if (ticket.type === 'emergency_sos' && priority !== 'critical') {
        throw httpError(400, 'An emergency SOS ticket must stay critical.');
      }
      ticket.priority = priority;
    }

    if (assignedRelationshipManager !== undefined) {
      if (assignedRelationshipManager === null || assignedRelationshipManager === '') {
        ticket.assignedRelationshipManager = null;
      } else {
        assertValidId(assignedRelationshipManager, 'assignedRelationshipManager');
        const rm = await User.findOne({
          _id: assignedRelationshipManager,
          role: 'relationship_manager',
          accountStatus: 'active',
        })
          .select('_id')
          .lean();
        if (!rm) throw httpError(400, 'The assignee must be an active relationship_manager.');
        ticket.assignedRelationshipManager = rm._id;
      }
    }

    const cleanSummary =
      resolutionSummary === undefined ? undefined : String(resolutionSummary).trim();
    if (cleanSummary !== undefined && cleanSummary.length > 1500) {
      throw httpError(400, 'resolutionSummary must be 1500 characters or fewer.');
    }

    if (status !== undefined) {
      if (!TICKET_STATUSES.includes(status)) {
        throw httpError(400, `status must be one of: ${TICKET_STATUSES.join(', ')}.`);
      }

      if (status === 'resolved') {
        const summary = cleanSummary !== undefined ? cleanSummary : ticket.resolution?.summary || '';
        if (!summary) throw httpError(400, 'resolutionSummary is required to resolve a ticket.');
        ticket.resolution = { resolvedBy: req.user._id, resolvedAt: new Date(), summary };
      } else if (status === 'closed') {
        if (!['resolved', 'closed'].includes(ticket.status)) {
          throw httpError(409, 'Resolve the ticket before closing it.', 'NOT_RESOLVED');
        }
      } else if (['resolved', 'closed'].includes(ticket.status)) {
        // Reopening: clear the old resolution (the audit log keeps the history)
        ticket.resolution = { resolvedBy: null, resolvedAt: null, summary: '' };
      }
      ticket.status = status;
    } else if (cleanSummary !== undefined) {
      if (!['resolved', 'closed'].includes(ticket.status)) {
        throw httpError(400, 'A resolution summary can only be set on a resolved or closed ticket.');
      }
      ticket.resolution.summary = cleanSummary;
    }

    await ticket.save();

    const populated = await SupportTicket.findById(ticket._id)
      .populate('user', 'name phone')
      .populate('assignedRelationshipManager', 'name phone')
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Ticket updated.',
      data: { ticket: populated },
    });
  } catch (err) {
    return next(err);
  }
};

// Reply to the customer, or leave an internal note only admins can see
// Reply to the customer, or leave an internal note only admins can see
const adminAddTicketMessage = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    assertValidId(ticketId, 'ticketId');

    const body = String(req.body.body ?? '').trim();
    if (!body) throw httpError(400, 'Message cannot be empty.');
    if (body.length > 2000) throw httpError(400, 'Message must be 2000 characters or fewer.');
    const internal = req.body.internal === true;

    const existing = await SupportTicket.findById(ticketId).select('status').lean();
    if (!existing) throw httpError(404, 'Ticket not found.');
    if (existing.status === 'closed') {
      throw httpError(409, 'This ticket is closed. Reopen it before replying.', 'TICKET_CLOSED');
    }

    const now = new Date();
    const set = {};
    if (!internal) {
      set.lastStaffReplyAt = now;
      // The first customer-visible reply means the ticket is being handled
      if (existing.status === 'open') set.status = 'in_review';
    }

    const update = {
      $push: { messages: { author: req.user._id, authorRole: 'admin', body, internal, createdAt: now } },
    };
    if (Object.keys(set).length > 0) update.$set = set;

    // 'messages.99' guards the 100-message cap atomically
    const updated = await SupportTicket.findOneAndUpdate(
      { _id: ticketId, status: { $ne: 'closed' }, 'messages.99': { $exists: false } },
      update,
      { returnDocument: 'after' }
    )
      .populate('messages.author', 'name role')
      .select('+messages')
      .lean();

    if (!updated) {
      throw httpError(409, 'The ticket is closed or has reached its 100-message limit.', 'THREAD_FULL');
    }

    return res.status(201).json({
      success: true,
      message: internal ? 'Internal note added.' : 'Reply sent to the customer.',
      data: { status: updated.status, messages: updated.messages },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { adminListTickets, adminGetTicket, adminUpdateTicket, adminAddTicketMessage };