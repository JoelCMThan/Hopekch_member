const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const memberRoutes = require('./routes/member.routes');
const groupRoutes = require('./routes/group.routes');
const unitRoutes = require('./routes/unit.routes');
const subdistrictRoutes = require('./routes/subdistrict.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const inactiveMemberRoutes = require('./routes/inactiveMember.routes');
const communicationRoutes = require('./routes/communication.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const ragRoutes = require('./routes/rag.routes');
const settingsRoutes = require('./routes/settings.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Hope Church API is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/subdistricts', subdistrictRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/inactive-members', inactiveMemberRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/settings', settingsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
