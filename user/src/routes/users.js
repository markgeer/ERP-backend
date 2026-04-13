// user/src/routes/users.js
const bcrypt = require('bcrypt');
const pool = require('../db');

async function usersRoutes(fastify, options) {
  // GET /users - Listar usuarios (requiere permiso user:view)
  fastify.get('/users', async (request, reply) => {
    try {
      const result = await pool.query(
        `SELECT id, nombre_completo, username, email, direccion, telefono, last_login, creado_en, permisos_globales
         FROM usuarios
         ORDER BY id`
      );

      return reply.send({
        statusCode: 200,
        intOpCode: 'SxUS200',
        data: result.rows
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
  fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const result = await pool.query(
        `SELECT id, nombre_completo, username, email, direccion, telefono, last_login, creado_en
         FROM usuarios
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({
          statusCode: 404,
          intOpCode: 'ERR404',
          data: { error: 'Usuario no encontrado' }
        });
      }

      return reply.send({
        statusCode: 200,
        intOpCode: 'SxUS200',
        data: result.rows[0]
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

  // PUT /users/:id - Actualizar usuario (requiere permiso user:edit)
  fastify.put('/users/:id', async (request, reply) => {
    const { id } = request.params;
    const { nombre_completo, username, email, direccion, telefono, password } = request.body;

    try {
      // Verificar si el usuario existe
      const existe = await pool.query('SELECT id FROM usuarios WHERE id = $1', [id]);
      if (existe.rows.length === 0) {
        return reply.code(404).send({
          statusCode: 404,
          intOpCode: 'ERR404',
          data: { error: 'Usuario no encontrado' }
        });
      }

      let updateFields = [];
      let updateValues = [];
      let paramIndex = 1;

      if (nombre_completo) {
        updateFields.push(`nombre_completo = $${paramIndex++}`);
        updateValues.push(nombre_completo);
      }
      if (username) {
        updateFields.push(`username = $${paramIndex++}`);
        updateValues.push(username);
      }
      if (email) {
        updateFields.push(`email = $${paramIndex++}`);
        updateValues.push(email);
      }
      if (direccion !== undefined) {
        updateFields.push(`direccion = $${paramIndex++}`);
        updateValues.push(direccion);
      }
      if (telefono !== undefined) {
        updateFields.push(`telefono = $${paramIndex++}`);
        updateValues.push(telefono);
      }
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateFields.push(`password = $${paramIndex++}`);
        updateValues.push(hashedPassword);
      }

      if (updateFields.length === 0) {
        return reply.code(400).send({
          statusCode: 400,
          intOpCode: 'ERR400',
          data: { error: 'No hay campos para actualizar' }
        });
      }

      updateValues.push(id);
      const query = `UPDATE usuarios SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING id, nombre_completo, username, email, direccion, telefono`;

      const result = await pool.query(query, updateValues);

      return reply.send({
        statusCode: 200,
        intOpCode: 'SxUS200',
        data: result.rows[0]
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

  // DELETE /users/:id - Eliminar usuario (requiere permiso user:delete)
  fastify.delete('/users/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const result = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [id]);

      if (result.rows.length === 0) {
        return reply.code(404).send({
          statusCode: 404,
          intOpCode: 'ERR404',
          data: { error: 'Usuario no encontrado' }
        });
      }

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