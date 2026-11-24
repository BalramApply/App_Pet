const mongoose = require('mongoose');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const Session = require('../models/Session');
const Booking = require('../models/Booking');
const ProfessionalProfile = require('../models/ProfessionalProfile');
const SessionAuditLog = require('../models/SessionAuditLog');

const PROFESSIONAL_ROLES = [
  'walker',
  'trainer',
  'groomer',
  'vet',
  'paravet',
  'counsellor',
  'relationship_manager',
];

const toWalletRole = (userRole) => {
  return PROFESSIONAL_ROLES.includes(userRole) ? 'professional' : 'client';
};

/**
 * Atomically credits or adjusts a user's wallet (typically called by Admin).
 * Uses MongoDB transaction + immutable WalletTransaction ledger entry.
 */
const adjustWalletByAdmin = async ({
  targetUserId,
  adminUserId,
  amount,
  type = 'credit',
  category = 'admin_topup',
  description,
  note = '',
  referenceId,
}) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    const err = new Error('Amount must be a positive number.');
    err.statusCode = 400;
    throw err;
  }

  if (!['credit', 'debit'].includes(type)) {
    const err = new Error('Transaction type must be credit or debit.');
    err.statusCode = 400;
    throw err;
  }

  const mongoSession = await mongoose.startSession();
  try {
    let resultPayload = null;

    await mongoSession.withTransaction(async () => {
      const targetUser = await User.findById(targetUserId).session(mongoSession);
      if (!targetUser) {
        const err = new Error('Target user not found.');
        err.statusCode = 404;
        throw err;
      }

      if (targetUser.accountStatus === 'deleted') {
        const err = new Error('Cannot modify wallet of a deleted account.');
        err.statusCode = 400;
        throw err;
      }

      const balanceBefore = Number(targetUser.walletBalance || 0);
      let balanceAfter = balanceBefore;

      if (type === 'credit') {
        balanceAfter = Number((balanceBefore + numericAmount).toFixed(2));
      } else {
        if (balanceBefore < numericAmount) {
          const err = new Error('Insufficient wallet balance for debit adjustment.');
          err.statusCode = 400;
          throw err;
        }
        balanceAfter = Number((balanceBefore - numericAmount).toFixed(2));
      }

      targetUser.walletBalance = balanceAfter;
      await targetUser.save({ session: mongoSession });

      const txRef =
        referenceId ||
        `ADMIN_${type.toUpperCase()}_${targetUser._id}_${Date.now()}_${Math.floor(
          Math.random() * 10000
        )}`;

      const [tx] = await WalletTransaction.create(
        [
          {
            user: targetUser._id,
            role: toWalletRole(targetUser.role),
            type,
            category,
            amount: numericAmount,
            balanceBefore,
            balanceAfter,
            performedBy: adminUserId,
            description:
              description ||
              (type === 'credit'
                ? `Admin wallet credit of INR ${numericAmount}`
                : `Admin wallet debit adjustment of INR ${numericAmount}`),
            metadata: {
              note,
            },
            referenceId: txRef,
          },
        ],
        { session: mongoSession }
      );

      resultPayload = {
        user: {
          _id: targetUser._id,
          name: targetUser.name,
          phone: targetUser.phone,
          role: targetUser.role,
          walletBalance: balanceAfter,
        },
        transaction: tx,
      };
    });

    return resultPayload;
  } finally {
    await mongoSession.endSession();
  }
};

/**
 * Atomically settles a completed session:
 * 1. Idempotency check on session.walletSettled & unique referenceIds
 * 2. Deducts sessionAmount from Client wallet (if > 0)
 * 3. Credits professionalPayoutAmount to Professional wallet (if > 0)
 * 4. Marks session.walletSettled = true and updates Booking + ProfessionalProfile stats
 */
const settleCompletedSession = async ({ sessionId, actorId, actorRole }) => {
  const mongoSession = await mongoose.startSession();
  try {
    let settlementSummary = null;

    await mongoSession.withTransaction(async () => {
      const sessionDoc = await Session.findById(sessionId)
        .populate('pet', 'name species')
        .session(mongoSession);

      if (!sessionDoc) {
        const err = new Error('Session not found.');
        err.statusCode = 404;
        throw err;
      }

      const bookingDoc = await Booking.findById(sessionDoc.booking)
        .populate('service', 'type title')
        .session(mongoSession);

      if (!bookingDoc) {
        const err = new Error('Associated booking not found.');
        err.statusCode = 404;
        throw err;
      }

      const clientUser = await User.findById(sessionDoc.customer).session(mongoSession);
      const proUser = await User.findById(sessionDoc.professional).session(mongoSession);

      if (!clientUser || !proUser) {
        const err = new Error('Customer or assigned professional not found.');
        err.statusCode = 404;
        throw err;
      }

      // Idempotency guard: if already settled, return existing ledger records without double charging/crediting
      if (sessionDoc.walletSettled) {
        const existingTx = await WalletTransaction.find({ session: sessionDoc._id })
          .sort({ createdAt: 1 })
          .session(mongoSession);

        settlementSummary = {
          alreadySettled: true,
          sessionId: sessionDoc._id,
          sessionAmount: sessionDoc.sessionAmount,
          professionalPayoutAmount: sessionDoc.professionalPayoutAmount,
          clientBalanceAfter: clientUser.walletBalance,
          professionalBalanceAfter: proUser.walletBalance,
          transactions: existingTx,
        };
        return;
      }

      const feeToDeduct = Number(sessionDoc.sessionAmount || 0);
      const payoutToCredit = Number(sessionDoc.professionalPayoutAmount || 0);
      const petName = sessionDoc.pet?.name || 'Pet';
      const serviceName = bookingDoc.service?.title || bookingDoc.service?.type || 'Pet Service';

      const createdTransactions = [];

      if (feeToDeduct > 0) {
        const clientBefore = Number(clientUser.walletBalance || 0);
        if (clientBefore < feeToDeduct) {
          const err = new Error(
            `Insufficient client wallet balance (INR ${clientBefore}) to settle session fee of INR ${feeToDeduct}.`
          );
          err.statusCode = 400;
          throw err;
        }
        const clientAfter = Number((clientBefore - feeToDeduct).toFixed(2));
        clientUser.walletBalance = clientAfter;
        await clientUser.save({ session: mongoSession });

        const [debitTx] = await WalletTransaction.create(
          [
            {
              user: clientUser._id,
              role: 'client',
              type: 'debit',
              category: 'session_payment',
              amount: feeToDeduct,
              balanceBefore: clientBefore,
              balanceAfter: clientAfter,
              booking: bookingDoc._id,
              session: sessionDoc._id,
              performedBy: actorId || null,
              description: `Session #${sessionDoc.sessionNumber} fee for ${petName} (${serviceName})`,
              metadata: {
                petName,
                serviceName,
              },
              referenceId: `SETTLE_DEBIT_SESSION_${sessionDoc._id}`,
            },
          ],
          { session: mongoSession }
        );
        createdTransactions.push(debitTx);
      }

      if (payoutToCredit > 0) {
        const proBefore = Number(proUser.walletBalance || 0);
        const proAfter = Number((proBefore + payoutToCredit).toFixed(2));
        proUser.walletBalance = proAfter;
        await proUser.save({ session: mongoSession });

        const [creditTx] = await WalletTransaction.create(
          [
            {
              user: proUser._id,
              role: 'professional',
              type: 'credit',
              category: 'session_earning',
              amount: payoutToCredit,
              balanceBefore: proBefore,
              balanceAfter: proAfter,
              booking: bookingDoc._id,
              session: sessionDoc._id,
              performedBy: actorId || null,
              description: `Session #${sessionDoc.sessionNumber} payout for ${petName} (${serviceName})`,
              metadata: {
                petName,
                serviceName,
              },
              referenceId: `SETTLE_CREDIT_SESSION_${sessionDoc._id}`,
            },
          ],
          { session: mongoSession }
        );
        createdTransactions.push(creditTx);
      }

      sessionDoc.walletSettled = true;
      sessionDoc.walletSettledAt = new Date();
      sessionDoc.reviewEligible = true;
      await sessionDoc.save({ session: mongoSession });

      // Update booking counts & status
      const completedCount = await Session.countDocuments({
        booking: bookingDoc._id,
        status: 'completed',
      }).session(mongoSession);

      bookingDoc.completedSessionCount = completedCount;
      bookingDoc.reviewEligibility = completedCount > 0;

      if (completedCount >= bookingDoc.totalSessionCount) {
        bookingDoc.status = 'completed';
        bookingDoc.serviceCompletionStatus = 'completed';
      } else if (completedCount > 0) {
        bookingDoc.status = 'upcoming';
        bookingDoc.serviceCompletionStatus = 'partial';
        bookingDoc.arrivalStatus = 'pending';
      }
      await bookingDoc.save({ session: mongoSession });

      // Update professional stats dynamically from DB counts
      const proProfile = await ProfessionalProfile.findOne({ user: proUser._id }).session(
        mongoSession
      );
      if (proProfile) {
        const totalAssigned = await Session.countDocuments({
          professional: proUser._id,
          status: { $ne: 'cancelled' },
        }).session(mongoSession);
        const totalCompleted = await Session.countDocuments({
          professional: proUser._id,
          status: 'completed',
        }).session(mongoSession);
        const totalCancelled = await Session.countDocuments({
          professional: proUser._id,
          status: 'cancelled',
        }).session(mongoSession);

        proProfile.totalAssignedSessions = totalAssigned;
        proProfile.totalCompletedSessions = totalCompleted;
        proProfile.totalCancelledSessions = totalCancelled;
        proProfile.completionPercentage =
          totalAssigned > 0 ? Number(((totalCompleted / totalAssigned) * 100).toFixed(2)) : 0;
        await proProfile.save({ session: mongoSession });
      }

      await SessionAuditLog.create(
        [
          {
            session: sessionDoc._id,
            booking: bookingDoc._id,
            actor: actorId || proUser._id,
            actorRole: actorRole || proUser.role,
            action: 'WALLET_SETTLED',
            previousStatus: sessionDoc.status,
            newStatus: sessionDoc.status,
            timestamp: new Date(),
            metadata: {
              feeToDeduct,
              payoutToCredit,
              clientBalanceAfter: clientUser.walletBalance,
              professionalBalanceAfter: proUser.walletBalance,
            },
          },
        ],
        { session: mongoSession }
      );

      settlementSummary = {
        alreadySettled: false,
        sessionId: sessionDoc._id,
        sessionAmount: feeToDeduct,
        professionalPayoutAmount: payoutToCredit,
        clientBalanceAfter: clientUser.walletBalance,
        professionalBalanceAfter: proUser.walletBalance,
        transactions: createdTransactions,
      };
    });

    return settlementSummary;
  } finally {
    await mongoSession.endSession();
  }
};

module.exports = {
  adjustWalletByAdmin,
  settleCompletedSession,
  toWalletRole,
};