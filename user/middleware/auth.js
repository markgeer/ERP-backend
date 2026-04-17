// user/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const config = require('../src/config');

async function authMiddleware(request, reply) {
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