const mongoose = require('mongoose');
const SupportTicket = require('../models/SupportTicket');

const MAX_BODY = 2000;

const httpError = (statusCode, message, code) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
};

const assertValidId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw httpError(400, 'Invalid ticket id.', 'INVALID_ID');
};

const isAdminUser = (user) => user?.role === 'admin';

// Customers see no internal notes and see staff as "PetJeeva Support".
// Admins see internal notes too, plus real staff names.
const toMessagesForViewer = (messages = [], viewer) => {
  const adminView = isAdminUser(viewer);
  const viewerId = viewer._id.toString();

  return messages
    .filter((m) => adminView || !m.internal)
    .map((m) => {
      const isStaff = m.authorRole === 'admin';
      const authorId = (m.author && m.author._id ? m.author._id : m.author)?.toString();
      return {
        _id: m._id,
        body: m.body,
        internal: Boolean(m.internal),
        createdAt: m.createdAt,
        fromStaff: isStaff,
        mine: authorId === viewerId,
        authorName: isStaff && !adminView ? 'PetJeeva Support' : m.author?.name || (isStaff ? 'Support' : 'Customer'),
      };
    });
};

// GET /api/support/tickets/:ticketId - owner or admin view
const getMyTicketThread = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    assertValidId(ticketId);

    const isAdmin = isAdminUser(req.user);
    const filter = isAdmin ? { _id: ticketId } : { _id: ticketId, user: req.user._id };

    const ticket = await SupportTicket.findOne(filter)
      .select('+messages')
      .populate('messages.author', 'name')
      .populate('assignedRelationshipManager', 'name phone')
      .lean();
    if (!ticket) throw httpError(404, 'Ticket not found.');

    // Only update userLastReadAt when the customer opens the thread
    if (!isAdmin) {
      await SupportTicket.updateOne({ _id: ticket._id }, { $set: { userLastReadAt: new Date() } });
    }

    return res.status(200).json({
      success: true,
      data: {
        ticket: {
          _id: ticket._id,
          ticketNumber: ticket.ticketNumber,
          type: ticket.type,
          status: ticket.status,
          priority: ticket.priority,
          subject: ticket.subject,
          notes: ticket.notes,
          createdAt: ticket.createdAt,
          assignedRelationshipManager: ticket.assignedRelationshipManager || null,
          resolutionSummary: ['resolved', 'closed'].includes(ticket.status) ? ticket.resolution?.summary || '' : '',
          canReply: ticket.status !== 'closed',
        },
        messages: toMessagesForViewer(ticket.messages, req.user),
      },
    });
  } catch (err) {
    return next(err);
  }
};

// POST /api/support/tickets/:ticketId/reply  { body, internal? }
const replyToMyTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    assertValidId(ticketId);

    const body = String(req.body.body ?? '').trim();
    if (!body) throw httpError(400, 'Please type a message.');
    if (body.length > MAX_BODY) throw httpError(400, `Message must be ${MAX_BODY} characters or fewer.`);

    const isAdmin = isAdminUser(req.user);
    // Only admins can post internal-only notes
    const internal = isAdmin && Boolean(req.body.internal);

    const accessFilter = isAdmin ? { _id: ticketId } : { _id: ticketId, user: req.user._id };

    const existing = await SupportTicket.findOne(accessFilter).select('status').lean();
    if (!existing) throw httpError(404, 'Ticket not found.');
    if (existing.status === 'closed') {
      throw httpError(409, 'This ticket is closed. Please raise a new request.', 'TICKET_CLOSED');
    }

    const now = new Date();
    const set = isAdmin
      ? { lastStaffReplyAt: now }
      : { lastUserReplyAt: now, userLastReadAt: now };

    if (isAdmin && existing.status === 'open') {
      // Optional: move newly replied open tickets to in_review for staff replies
      set.status = 'in_review';
    } else if (!isAdmin && existing.status === 'resolved') {
      // Customer reply on a resolved ticket reopens it
      set.status = 'open';
      set.resolution = { resolvedBy: null, resolvedAt: null, summary: '' };
    }

    const updated = await SupportTicket.findOneAndUpdate(
      {
        ...accessFilter,
        status: { $ne: 'closed' },
        'messages.99': { $exists: false },
      },
      {
        $push: {
          messages: {
            author: req.user._id,
            authorRole: req.user.role,
            body,
            internal,
            createdAt: now,
          },
        },
        $set: set,
      },
      { returnDocument: 'after' }
    )
      .populate('messages.author', 'name')
      .select('+messages')
      .lean();

    if (!updated) {
      throw httpError(409, 'This conversation is closed or has reached its message limit.', 'THREAD_FULL');
    }

    return res.status(201).json({
      success: true,
      data: { status: updated.status, messages: toMessagesForViewer(updated.messages, req.user) },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { getMyTicketThread, replyToMyTicket, toMessagesForViewer };