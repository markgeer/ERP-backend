// apigateway/src/index.js
const fastify = require('fastify')({ logger: true });
const httpProxy = require('@fastify/http-proxy');
const rateLimit = require('@fastify/rate-limit');
const cors = require('@fastify/cors');  // ✅ Agregar
const config = require('./config');
const { authMiddleware } = require('./middleware/auth');

// ✅ Registrar CORS (debe ir antes que cualquier otra cosa)
fastify.register(cors, {
  origin: true,  // Permite cualquier origen (para desarrollo)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
});

// Registrar rate limiting
fastify.register(rateLimit, {
  max: config.rateLimit.max,
  timeWindow: config.rateLimit.timeWindow,
  errorResponseBuilder: function (request, context) {
    return {
      statusCode: 429,
      intOpCode: 'ERR429',
      data: { error: 'Too many requests, please try again later.' }
    };
  }
});

// Middleware global de autenticación
fastify.addHook('preHandler', async (request, reply) => {
  await authMiddleware(request, reply);
});

// Proxy para microservicio USER
fastify.register(httpProxy, {
  upstream: config.services.user,
  prefix: '/user',
  rewritePrefix: '',
});

// Proxy para microservicio GROUPS
fastify.register(httpProxy, {
  upstream: config.services.groups,
  prefix: '/groups',
  rewritePrefix: '',
});

// Proxy para microservicio TICKETS
fastify.register(httpProxy, {
  upstream: config.services.tickets,
  prefix: '/tickets',
  rewritePrefix: '',
});

// Ruta de health check
fastify.get('/health', async (request, reply) => {
  return {
    statusCode: 200,
    intOpCode: 'SxUS200',
    data: { status: 'OK', timestamp: new Date().toISOString() }
  };
});

// Ruta raíz
fastify.get('/', async (request, reply) => {
  return {
    statusCode: 200,
    intOpCode: 'SxUS200',
    data: {
      message: 'API Gateway ERP',
      version: '1.0.0',
      services: {
        user: config.services.user,
        groups: config.services.groups,
        tickets: config.services.tickets,
      }
    }
  };
});

// Iniciar servidor
const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚪 API Gateway corriendo en puerto ${config.port}`);
    console.log(`📋 Endpoints disponibles:`);
    console.log(`   POST /user/auth/login - Login`);
    console.log(`   POST /user/auth/register - Registro`);
    console.log(`   GET  /groups/groups - Listar grupos`);
    console.log(`   POST /groups/groups - Crear grupo`);
    console.log(`   GET  /tickets/tickets?grupoId=X - Listar tickets`);
    console.log(`   POST /tickets/tickets - Crear ticket`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();