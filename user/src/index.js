// user/src/index.js
const fastify = require('fastify')({ logger: true });
const config = require('./config');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');

// Registrar rutas
fastify.register(authRoutes);
fastify.register(usersRoutes);

// Iniciar servidor
const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🔵 Microservicio user corriendo en puerto ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();