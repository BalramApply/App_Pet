const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');

const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

let ioInstance = null;

const initSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 25000,
    pingInterval: 10000,
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');

      if (!token) {
        return next(new Error('Socket authentication token required'));
      }

      const secret = process.env.JWT_ACCESS_SECRET;
      const decoded = jwt.verify(token, secret);
      const user = await User.findById(decoded.sub).select('name role accountStatus').lean();

      if (!user || user.accountStatus !== 'active') {
        return next(new Error('Socket user inactive or not found'));
      }

      socket.user = {
        _id: user._id.toString(),
        name: user.name,
        role: user.role,
      };
      return next();
    } catch (err) {
      return next(new Error('Invalid socket token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join_session', async (payload = {}) => {
      try {
        const { sessionId } = payload;
        if (!sessionId) return;

        const sessionDoc = await Session.findById(sessionId)
          .select('customer professional status startedAt scheduledEndAt scheduledDurationMinutes distanceCovered latestLocation')
          .lean();

        if (!sessionDoc) return;

        const isCustomer = sessionDoc.customer.toString() === socket.user._id;
        const isPro = sessionDoc.professional.toString() === socket.user._id;
        const isAdmin = socket.user.role === 'admin';

        if (!isCustomer && !isPro && !isAdmin) {
          return;
        }

        const roomName = `session:${sessionId}`;
        socket.join(roomName);

        const nowMs = Date.now();
        const endMs = sessionDoc.scheduledEndAt ? new Date(sessionDoc.scheduledEndAt).getTime() : null;
        const remainingSeconds =
          endMs && sessionDoc.status === 'in_progress'
            ? Math.max(0, Math.floor((endMs - nowMs) / 1000))
            : 0;
        const elapsedSeconds = sessionDoc.startedAt
          ? Math.max(0, Math.floor((nowMs - new Date(sessionDoc.startedAt).getTime()) / 1000))
          : 0;

        socket.emit('session_state_sync', {
          sessionId,
          status: sessionDoc.status,
          serverTime: new Date(nowMs).toISOString(),
          startedAt: sessionDoc.startedAt,
          scheduledEndAt: sessionDoc.scheduledEndAt,
          elapsedSeconds,
          remainingSeconds,
          distanceCovered: sessionDoc.distanceCovered || 0,
          latestLocation: sessionDoc.latestLocation || null,
        });
      } catch (err) {
        console.error('join_session error:', err.message);
      }
    });

    socket.on('leave_session', (payload = {}) => {
      if (payload.sessionId) {
        socket.leave(`session:${payload.sessionId}`);
      }
    });

    socket.on('location_update', async (payload = {}) => {
      try {
        const { sessionId, lat, lng, accuracy = null, speed = null, heading = null } = payload;
        if (!sessionId || typeof lat !== 'number' || typeof lng !== 'number') {
          return;
        }

        const sessionDoc = await Session.findById(sessionId);
        if (!sessionDoc) return;

        const isAssignedPro = sessionDoc.professional.toString() === socket.user._id;
        if (!isAssignedPro && socket.user.role !== 'admin') {
          return;
        }

        if (!['professional_arrived', 'in_progress'].includes(sessionDoc.status)) {
          return;
        }

        let addedKm = 0;
        if (
          sessionDoc.latestLocation &&
          typeof sessionDoc.latestLocation.lat === 'number' &&
          typeof sessionDoc.latestLocation.lng === 'number' &&
          sessionDoc.status === 'in_progress'
        ) {
          const delta = haversineDistanceKm(
            sessionDoc.latestLocation.lat,
            sessionDoc.latestLocation.lng,
            lat,
            lng
          );
          // Filter GPS jitter (< 2 meters) and unrealistic jumps (> 2 km per ping)
          if (delta >= 0.002 && delta <= 2) {
            addedKm = delta;
          }
        }

        const now = new Date();
        sessionDoc.coordinates.push({
          lat,
          lng,
          accuracy,
          speed,
          heading,
          recordedAt: now,
        });
        sessionDoc.latestLocation = {
          lat,
          lng,
          updatedAt: now,
        };
        sessionDoc.distanceCovered = Number(
          ((sessionDoc.distanceCovered || 0) + addedKm).toFixed(3)
        );
        await sessionDoc.save();

        io.to(`session:${sessionId}`).emit('location_update', {
          sessionId,
          lat,
          lng,
          accuracy,
          speed,
          heading,
          distanceCovered: sessionDoc.distanceCovered,
          updatedAt: now.toISOString(),
        });
      } catch (err) {
        console.error('location_update error:', err.message);
      }
    });
  });

  ioInstance = io;
  return io;
};

const getIO = () => ioInstance;

module.exports = {
  initSocketServer,
  getIO,
};