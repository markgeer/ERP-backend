const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../db');
const config = require('../config');

async function authRoutes(fastify, options) {

  // REGISTRO
  fastify.post('/auth/register', async (request, reply) => {
    const { nombre_completo, username, email, password, direccion, telefono } = request.body;

    if (!nombre_completo || !username || !email || !password) {
      return reply.code(400).send({
        statusCode: 400, intOpCode: 'ERR400',
        data: { error: 'Faltan campos obligatorios' }
      });
    }

    try {
      // Verificar si ya existe
      const { data: existe } = await supabase
        .from('usuarios')
        .select('id')
        .or(`email.eq.${email},username.eq.${username}`)
        .maybeSingle();

      if (existe) {
        return reply.code(400).send({
          statusCode: 400, intOpCode: 'ERR400',
          data: { error: 'El email o usuario ya está registrado' }
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const { data: nuevoUsuario, error } = await supabase
        .from('usuarios')
        .insert([{
          nombre_completo,
          username,
          email,
          password: hashedPassword,
          direccion: direccion || null,
          telefono: telefono || null,
          permisos_globales: [1, 4]
        }])
        .select('id, nombre_completo, username, email')
        .single();

      if (error) throw error;

      return reply.code(201).send({
        statusCode: 201, intOpCode: 'SxUS201',
        data: nuevoUsuario
      });

    } catch (error) {
      console.error(error);
      return reply.code(500).send({
        statusCode: 500, intOpCode: 'ERR500',
        data: { error: 'Error interno del servidor' }
      });
    }
  });

  // LOGIN
  fastify.post('/auth/login', async (request, reply) => {
    const { username, email, password } = request.body;
    const loginIdentifier = username || email;

    if (!loginIdentifier || !password) {
      return reply.code(400).send({
        statusCode: 400, intOpCode: 'ERR400',
        data: { error: 'Usuario/Email y contraseña son requeridos' }
      });
    }

    try {
      const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('id, nombre_completo, username, email, password, permisos_globales')
        .or(`username.eq.${loginIdentifier},email.eq.${loginIdentifier}`)
        .maybeSingle();

      if (error) throw error;

      if (!usuario) {
        return reply.code(401).send({
          statusCode: 401, intOpCode: 'ERR401',
          data: { error: 'Credenciales incorrectas' }
        });
      }

      const passwordValido = await bcrypt.compare(password, usuario.password);
      if (!passwordValido) {
        return reply.code(401).send({
          statusCode: 401, intOpCode: 'ERR401',
          data: { error: 'Credenciales incorrectas' }
        });
      }

      // Actualizar last_login
      await supabase
        .from('usuarios')
        .update({ last_login: new Date().toISOString() })
        .eq('id', usuario.id);

      // Permisos por grupo
      const { data: permisosGrupos } = await supabase
        .from('grupo_usuario_permisos')
        .select('permisos_grupo, grupo_id, grupos(nombre)')
        .eq('usuario_id', usuario.id);

      const permissionsByGroup = {};
      (permisosGrupos || []).forEach(row => {
        permissionsByGroup[row.grupo_id] = {
          grupo_nombre: row.grupos?.nombre,
          permisos: row.permisos_grupo
        };
      });

      const token = jwt.sign(
        {
          userId: usuario.id,
          username: usuario.username,
          email: usuario.email,
          permissionsByGroup,
          globalPermissions: usuario.permisos_globales
        },
        config.jwtSecret,
        { expiresIn: '24h' }
      );

      return reply.send({
        statusCode: 200, intOpCode: 'SxUS200',
        data: {
          token,
          user: {
            id: usuario.id,
            nombre_completo: usuario.nombre_completo,
            username: usuario.username,
            email: usuario.email
          }
        }
      });

    } catch (error) {
      console.error(error);
      return reply.code(500).send({
        statusCode: 500, intOpCode: 'ERR500',
        data: { error: 'Error interno del servidor' }
      });
    }
  });
}

module.exports = authRoutes;