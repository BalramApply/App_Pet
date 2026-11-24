const AdminAuditLog = require('../models/AdminAuditLog');

const SENSITIVE_KEY = /pass|token|secret/i;
const MAX_STRING = 500;
const READ_ONLY_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Copies a request body, hiding secrets and trimming anything large
const redact = (value, depth = 0) => {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' && value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}...`
      : value;
  }
  if (depth > 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, SENSITIVE_KEY.test(k) ? '[REDACTED]' : redact(v, depth + 1)])
  );
};

/**
 * Records every admin write request once the response has been sent.
 * Mount after protect + authorizeRoles('admin') so req.user is the admin.
 * It never blocks or fails the request itself.
 */
const adminAudit = (req, res, next) => {
  if (READ_ONLY_METHODS.includes(req.method)) return next();

  let requestBody = {};
  try {
    requestBody = redact(req.body || {});
  } catch (e) {
    requestBody = { note: 'body could not be recorded' };
  }

  res.on('finish', () => {
    try {
      const cleanPath = req.originalUrl.split('?')[0];
      const idMatch = cleanPath.match(/[0-9a-f]{24}/i);
      AdminAuditLog.create({
        actor: req.user._id,
        actorName: req.user.name || '',
        method: req.method,
        path: cleanPath,
        action: `${req.method} ${cleanPath.replace(/[0-9a-f]{24}/gi, ':id')}`,
        targetId: idMatch ? idMatch[0] : '',
        statusCode: res.statusCode,
        success: res.statusCode < 400,
        requestBody,
        ip: req.ip || '',
        userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
      }).catch((err) => console.error('Admin audit log write failed:', err.message));
    } catch (err) {
      console.error('Admin audit log error:', err.message);
    }
  });

  return next();
};

module.exports = { adminAudit, redact };