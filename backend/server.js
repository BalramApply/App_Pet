require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { initSocketServer } = require('./sockets/socketServer');
const authRoutes = require('./routes/authRoutes');
const configAndUserRoutes = require('./routes/configAndUserRoutes');
const walletCatalogAndBookingRoutes = require('./routes/walletCatalogAndBookingRoutes');
const sessionAndCareRoutes = require('./routes/sessionAndCareRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'PetJeeva API',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', configAndUserRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', walletCatalogAndBookingRoutes);
app.use('/api', sessionAndCareRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);
initSocketServer(httpServer);

connectDB()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`PetJeeva server & Socket.io running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });