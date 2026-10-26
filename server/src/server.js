require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./config/db');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

startServer();