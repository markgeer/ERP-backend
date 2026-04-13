// apigateway/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const config = require('../config');

// Rutas públicas (no requieren token)
const publicRoutes = [
  { method: 'POST', path: '/user/auth/login' },
  { method: 'POST', path: '/user/auth/register' },
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/' },
];

function isPublicRoute(method, url) {
  return publicRoutes.some(route => route.method === method && url.startsWith(route.path));
}

async function authMiddleware(request, reply) {
  // Verificar si es ruta pública
  if (isPublicRoute(request.method, request.url)) {
    return;
  }

  try {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return reply.code(401).send({
        statusCode: 401,
        intOpCode: 'ERR401',
        data: { error: 'Token no proporcionado' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, config.jwtSecret);
    request.user = decoded;
    return;
  } catch (error) {
    return reply.code(401).send({
      statusCode: 401,
      intOpCode: 'ERR401',
      data: { error: 'Token inválido o expirado' }
    });
  }
}

module.exports = { authMiddleware };