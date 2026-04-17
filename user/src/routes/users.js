// user/src/routes/users.js
const bcrypt = require('bcrypt');
const supabase = require('../db');
const { authMiddleware } = require('../../middleware/auth');

async function usersRoutes(fastify, options) {
  // GET /users - Listar usuarios (con middleware)
  fastify.get('/users', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      console.log('GET /users llamado - usuario autenticado:', request.user?.userId);
      
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre_completo, username, email, telefono, direccion, permisos_globales')
        .order('id');

      if (error) throw error;

      console.log('Usuarios encontrados:', data.length);
      console.log('Primer usuario:', data[0]); // Ver qué campos tiene

      return reply.send({
        statusCode: 200,
        intOpCode: 'SxUS200',
        data: data
      });
    } catch (error) {
      console.error(error);
      return reply.code(500).send({
        statusCode: 500,
        intOpCode: 'ERR500',
        data: { error: error.message }
      });
    }
  });

  // PUT /users/:id/permissions - Actualizar permisos globales del usuario
    fastify.put('/users/:id/permissions', { preHandler: [authMiddleware] }, async (request, reply) => {
      console.log('Endpoint de permisos llamado:', request.params.id, request.body);
      const { id } = request.params;
      const { permisos } = request.body;

      try {
        const { error } = await supabase
          .from('usuarios')
          .update({ permisos_globales: permisos })
          .eq('id', id);

        if (error) throw error;

        return reply.send({
          statusCode: 200,
          intOpCode: 'SxUS200',
          data: { message: 'Permisos actualizados correctamente' }
        });
      } catch (error) {
        console.error(error);
        return reply.code(500).send({
          statusCode: 500,
          intOpCode: 'ERR500',
          data: { error: 'Error interno del servidor' }
        });
      }
    });

  

  // GET /users/:id - Obtener usuario por ID
    fastify.get('/users/:id', { preHandler: [require('../../middleware/auth').authMiddleware] }, async (request, reply) => {
      const { id } = request.params;

      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('id, nombre_completo, username, email, direccion, telefono, last_login, creado_en')
          .eq('id', id)
          .single();

        if (error || !data) {
          return reply.code(404).send({
            statusCode: 404, intOpCode: 'ERR404',
            data: { error: 'Usuario no encontrado' }
          });
        }

        return reply.send({
          statusCode: 200, intOpCode: 'SxUS200',
          data: data
        });
      } catch (error) {
        console.error(error);
        return reply.code(500).send({
          statusCode: 500, intOpCode: 'ERR500',
          data: { error: 'Error interno del servidor' }
        });
      }
    });

  // PUT /users/:id - Actualizar usuario
  fastify.put('/users/:id', async (request, reply) => {
    const { id } = request.params;
    const { nombre_completo, username, email, direccion, telefono, password } = request.body;

    try {
      const updateData = {};
      if (nombre_completo) updateData.nombre_completo = nombre_completo;
      if (username) updateData.username = username;
      if (email) updateData.email = email;
      if (direccion !== undefined) updateData.direccion = direccion;
      if (telefono !== undefined) updateData.telefono = telefono;
      if (password) updateData.password = await bcrypt.hash(password, 10);

      if (Object.keys(updateData).length === 0) {
        return reply.code(400).send({
          statusCode: 400,
          intOpCode: 'ERR400',
          data: { error: 'No hay campos para actualizar' }
        });
      }

      const { data, error } = await supabase
        .from('usuarios')
        .update(updateData)
        .eq('id', id)
        .select('id, nombre_completo, username, email')
        .single();

      if (error) throw error;

      return reply.send({
        statusCode: 200,
        intOpCode: 'SxUS200',
        data: data
      });
    } catch (error) {
      console.error(error);
      return reply.code(500).send({
        statusCode: 500,
        intOpCode: 'ERR500',
        data: { error: error.message }
      });
    }
  });

  // DELETE /users/:id - Eliminar usuario
  fastify.delete('/users/:id', { preHandler: [authMiddleware], schema: { body: null } }, async (request, reply) => {
    const { id } = request.params;

    try {
      // 1. Eliminar comentarios del usuario
      await supabase.from('comentarios').delete().eq('autor_id', id);
      
      // 2. Eliminar historial del usuario
      await supabase.from('historial_tickets').delete().eq('usuario_id', id);
      
      // 3. Eliminar permisos del usuario en grupos
      await supabase.from('grupo_usuario_permisos').delete().eq('usuario_id', id);
      
      // 4. Eliminar membresías de grupos
      await supabase.from('grupo_miembros').delete().eq('usuario_id', id);
      
      // 5. Desasignar tickets (poner autor_id y asignado_id en null)
      await supabase.from('tickets').update({ autor_id: null }).eq('autor_id', id);
      await supabase.from('tickets').update({ asignado_id: null }).eq('asignado_id', id);
      
      // 6. Finalmente eliminar el usuario
      const { error } = await supabase.from('usuarios').delete().eq('id', id);

      if (error) throw error;

      return reply.send({
        statusCode: 200,
        intOpCode: 'SxUS200',
        data: { message: 'Usuario eliminado correctamente' }
      });
    } catch (error) {
      console.error(error);
      return reply.code(500).send({
        statusCode: 500,
        intOpCode: 'ERR500',
        data: { error: 'Error interno del servidor' }
      });
    }
  });


}

module.exports = usersRoutes;