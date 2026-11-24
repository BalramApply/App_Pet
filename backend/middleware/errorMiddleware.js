const notFound = (req, res, next) => {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
};

const errorHandler = (err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || 'SERVER_ERROR';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
  } else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid identifier for field: ${err.path}`;
  } else if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_RECORD';
    const fields = Object.keys(err.keyValue || {}).join(', ');
    message = `Duplicate value for ${fields || 'unique field'}`;
  }

  if (statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    code,
    message: isProd && statusCode >= 500 ? 'Something went wrong on our end.' : message,
    ...(isProd ? {} : { stack: err.stack }),
  });
};

module.exports = {
  notFound,
  errorHandler,
};