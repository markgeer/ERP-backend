// apigateway/src/config.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  port: process.env.GATEWAY_PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'mi_secreto_default',
  services: {
    user: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    groups: process.env.GROUPS_SERVICE_URL || 'http://localhost:3002',
    tickets: process.env.TICKETS_SERVICE_URL || 'http://localhost:3003',
  },
  rateLimit: {
    max: 100,      // Máximo 100 requests
    timeWindow: '1 minute', // por minuto
  },
};