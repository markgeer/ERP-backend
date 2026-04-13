// user/src/routes/users.js
const bcrypt = require('bcrypt');
const supabase = require('../db');

async function usersRoutes(fastify, options) {
  // GET /users - Listar usuarios (sin middleware por ahora)
  fastify.get('/users', async (request, reply) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre_completo, username, email')
        .order('id');

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

  // GET /users/:id - Obtener usuario por ID
  fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre_completo, username, email')
        .eq('id', id)
        .single();

      if (error || !data) {
        return reply.code(404).send({
          statusCode: 404,
          intOpCode: 'ERR404',
          data: { error: 'Usuario no encontrado' }
        });
      }

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
  fastify.delete('/users/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', id);

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
        data: { error: error.message }
      });
    }
  });
}

module.exports = usersRoutes;