// apigateway/src/index.js
const fastify = require('fastify')({ logger: true });
const httpProxy = require('@fastify/http-proxy');
const rateLimit = require('@fastify/rate-limit');
const cors = require('@fastify/cors');
const { createClient } = require('@supabase/supabase-js');
const config = require('./config');
const { authMiddleware } = require('./middleware/auth');

// Conectar a Supabase para logs
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ✅ Registrar CORS (debe ir antes que cualquier otra cosa)
fastify.register(cors, {
  origin: true,
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

// ✅ HOOK para registrar cada petición (se ejecuta después de cada respuesta)
fastify.addHook('onResponse', async (request, reply) => {
  const responseTime = reply.elapsedTime;
  const ip = request.headers['x-forwarded-for'] || request.ip;
  
  const logData = {
    endpoint: request.url,
    method: request.method,
    usuario_id: request.user?.userId || null,
    ip: ip,
    status_code: reply.statusCode,
    response_time: Math.round(responseTime),
    error_message: reply.statusCode >= 400 ? (reply.message || 'Error') : null
  };
  
  // Guardar en Supabase (sin esperar respuesta para no bloquear)
  supabase.from('logs_api').insert(logData).then(result => {
    if (result.error) {
      console.error('Error al guardar log:', result.error);
    }
  }).catch(err => console.error('Error:', err));
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

// ✅ Endpoint para ver logs (solo administradores)
fastify.get('/admin/logs', { preHandler: authMiddleware }, async (request, reply) => {
  const userPermisos = request.user?.globalPermissions || [];
  if (!userPermisos.includes(6)) {
    return reply.code(403).send({
      statusCode: 403,
      intOpCode: 'ERR403',
      data: { error: 'No tienes permiso para ver los logs' }
    });
  }
  
  const { limit = 100, endpoint, usuario_id } = request.query;
  
  let query = supabase
    .from('logs_api')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));
  
  if (endpoint) {
    query = query.eq('endpoint', endpoint);
  }
  if (usuario_id) {
    query = query.eq('usuario_id', parseInt(usuario_id));
  }
  
  const { data, error } = await query;
  
  if (error) {
    return reply.code(500).send({
      statusCode: 500,
      intOpCode: 'ERR500',
      data: { error: error.message }
    });
  }
  
  return reply.send({
    statusCode: 200,
    intOpCode: 'SxUS200',
    data: data
  });
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
    console.log(`   GET  /admin/logs - Ver logs (solo admin)`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();