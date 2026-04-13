// tickets/src/index.js
const fastify = require('fastify')({ logger: true });
const config = require('./config');
const ticketsRoutes = require('./routes/tickets');

fastify.register(ticketsRoutes);

const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`📌 Microservicio tickets corriendo en puerto ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();