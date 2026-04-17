// groups/src/routes/groups.js
const supabase = require('../db');

async function groupsRoutes(fastify, options) {
  // ============================================
  // GRUPOS (CRUD)
  // ============================================

  // GET /groups - Listar grupos del usuario autenticado
  fastify.get('/groups', { preHandler: [require('../middleware/auth').authMiddleware] }, async (request, reply) => {
    const userId = request.user.userId;

    try {
      // Obtener grupos donde el usuario es miembro
      const { data: grupos, error } = await supabase
        .from('grupo_miembros')
        .select(`
          grupo_id,
          grupos (
            id,
            nombre,
            descripcion,
            creador_id,
            creado_en
          )
        `)
        .eq('usuario_id', userId);

      if (error) throw error;

      const gruposList = grupos.map(g => g.grupos).filter(g => g !== null);

      return reply.send({
        statusCode: 200,
        intOpCode: 'SxUS200',
        data: gruposList
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

  // GET /groups/all - Listar todos los grupos (solo con permiso group:view)
  // GET /groups/all - Listar todos los grupos
  fastify.get('/groups/all', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      const { data, error } = await supabase
        .from('grupos')
        .select('*')
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
        data: { error: 'Error interno del servidor' }
      });
    }
  });

  // POST /groups - Crear grupo (requiere permiso group:add)
  fastify.post('/groups', { preHandler: [require('../middleware/auth').authMiddleware] }, async (request, reply) => {
    const { nombre, descripcion } = request.body;
    const userId = request.user.userId;

    if (!nombre) {
      return reply.code(400).send({
        statusCode: 400,
        intOpCode: 'ERR400',
        data: { error: 'El nombre del grupo es requerido' }
      });
    }

    try {
      // Crear grupo
      const { data: nuevoGrupo, error: createError } = await supabase
        .from('grupos')
        .insert({
          nombre,
          descripcion: descripcion || null,
          creador_id: userId
        })
        .select()
        .single();

      if (createError) throw createError;

      // Agregar creador como miembro
      await supabase
        .from('grupo_miembros')
        .insert({
          grupo_id: nuevoGrupo.id,
          usuario_id: userId
        });

      return reply.code(201).send({
        statusCode: 201,
        intOpCode: 'SxUS201',
        data: nuevoGrupo
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

  // PUT /groups/:id - Editar grupo (requiere permiso group:edit)
  fastify.put('/groups/:id', { preHandler: [require('../middleware/auth').authMiddleware] }, async (request, reply) => {
    const { id } = request.params;
    const { nombre, descripcion } = request.body;

    try {
      const updateData = {};
      if (nombre) updateData.nombre = nombre;
      if (descripcion !== undefined) updateData.descripcion = descripcion;

      if (Object.keys(updateData).length === 0) {
        return reply.code(400).send({
          statusCode: 400,
          intOpCode: 'ERR400',
          data: { error: 'No hay campos para actualizar' }
        });
      }

      const { data, error } = await supabase
        .from('grupos')
        .update(updateData)
        .eq('id', id)
        .select()
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
        data: { error: 'Error interno del servidor' }
      });
    }
  });

  // DELETE /groups/:id - Eliminar grupo (requiere permiso group:delete)
  fastify.delete('/groups/:id', { preHandler: [require('../middleware/auth').authMiddleware] }, async (request, reply) => {
    const { id } = request.params;

    try {
      const { error } = await supabase
        .from('grupos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return reply.send({
        statusCode: 200,
        intOpCode: 'SxUS200',
        data: { message: 'Grupo eliminado correctamente' }
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

  // ============================================
  // MIEMBROS DEL GRUPO
  // ============================================

  // GET /groups/:id/members - Listar miembros del grupo
  fastify.get('/groups/:id/members', { preHandler: [require('../middleware/auth').authMiddleware] }, async (request, reply) => {
    const { id } = request.params;

    try {
      const { data, error } = await supabase
        .from('grupo_miembros')
        .select(`
          usuario_id,
          fecha_unido,
          usuarios (
            id,
            nombre_completo,
            username,
            email
          )
        `)
        .eq('grupo_id', id);

      if (error) throw error;

      const miembros = data.map(m => ({
        id: m.usuario_id,
        nombre_completo: m.usuarios?.nombre_completo,
        username: m.usuarios?.username,
        email: m.usuarios?.email,
        fecha_unido: m.fecha_unido
      }));

      return reply.send({
        statusCode: 200,
        intOpCode: 'SxUS200',
        data: miembros
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

  // POST /groups/:id/members - Agregar miembro al grupo (requiere permiso group:add:member)
  fastify.post('/groups/:id/members', { preHandler: [require('../middleware/auth').authMiddleware] }, async (request, reply) => {
    const { id } = request.params;
    const { email, permisos } = request.body;  // ✅ Asegúrate que esté aquí

    console.log('Body recibido:', request.body); // 👈 Depuración

    if (!email) {
      return reply.code(400).send({
        statusCode: 400, intOpCode: 'ERR400',
        data: { error: 'El email es requerido' }
      });
    }

    try {
      const { data: usuario, error: userError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', email)
        .single();

      if (userError || !usuario) {
        return reply.code(404).send({
          statusCode: 404, intOpCode: 'ERR404',
          data: { error: 'Usuario no encontrado' }
        });
      }

      // Verificar si ya es miembro
      const { data: existe } = await supabase
        .from('grupo_miembros')
        .select('*')
        .eq('grupo_id', id)
        .eq('usuario_id', usuario.id)
        .single();

      if (existe) {
        return reply.code(400).send({
          statusCode: 400, intOpCode: 'ERR400',
          data: { error: 'El usuario ya es miembro del grupo' }
        });
      }

      // Agregar miembro
      const { error: insertError } = await supabase
        .from('grupo_miembros')
        .insert({ grupo_id: id, usuario_id: usuario.id });

      if (insertError) throw insertError;

      // ✅ Asignar permisos si vienen
      if (permisos && permisos.length > 0) {
        console.log('Asignando permisos:', permisos, 'al usuario:', usuario.id);
        const { error: permError } = await supabase
          .from('grupo_usuario_permisos')
          .upsert({
            grupo_id: id,
            usuario_id: usuario.id,
            permisos_grupo: permisos
          });

        if (permError) {
          console.error('Error al asignar permisos:', permError);
          throw permError;
        }
      }

      return reply.code(201).send({
        statusCode: 201, intOpCode: 'SxUS201',
        data: { id: usuario.id, message: 'Usuario agregado al grupo correctamente' }
      });
    } catch (error) {
      console.error(error);
      return reply.code(500).send({
        statusCode: 500, intOpCode: 'ERR500',
        data: { error: 'Error interno del servidor' }
      });
    }
  });

  // DELETE /groups/:id/members/:userId - Eliminar miembro del grupo (requiere permiso group:delete:member)
  fastify.delete('/groups/:id/members/:userId', { 
    preHandler: [require('../middleware/auth').authMiddleware],
    schema: { body: null }  // ✅ Agrega esto para que no espere body
  }, async (request, reply) => {
    const { id, userId } = request.params;

    try {
      const { error } = await supabase
        .from('grupo_miembros')
        .delete()
        .eq('grupo_id', id)
        .eq('usuario_id', userId);

      if (error) throw error;

      return reply.send({
        statusCode: 200,
        intOpCode: 'SxUS200',
        data: { message: 'Usuario eliminado del grupo correctamente' }
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

  // ============================================
  // PERMISOS POR GRUPO
  // ============================================

  // GET /groups/:id/permissions/:userId - Obtener permisos de un usuario en el grupo
  fastify.get('/groups/:id/permissions/:userId', { preHandler: [require('../middleware/auth').authMiddleware] }, async (request, reply) => {
    const { id, userId } = request.params;

    try {
      const { data, error } = await supabase
        .from('grupo_usuario_permisos')
        .select('permisos_grupo')
        .eq('grupo_id', id)
        .eq('usuario_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return reply.send({
        statusCode: 200,
        intOpCode: 'SxUS200',
        data: { permisos: data?.permisos_grupo || [] }
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

  // PUT /groups/:id/permissions/:userId - Asignar permisos a un usuario en el grupo (requiere permiso users:manage)
  fastify.put('/groups/:id/permissions/:userId', { preHandler: [require('../middleware/auth').authMiddleware] }, async (request, reply) => {
    const { id, userId } = request.params;
    const { permisos } = request.body;

    if (!permisos || !Array.isArray(permisos)) {
      return reply.code(400).send({
        statusCode: 400,
        intOpCode: 'ERR400',
        data: { error: 'Se requiere un array de permisos' }
      });
    }

    try {
      const { error } = await supabase
        .from('grupo_usuario_permisos')
        .upsert({
          grupo_id: id,
          usuario_id: userId,
          permisos_grupo: permisos
        }, {
          onConflict: 'grupo_id, usuario_id'
        });

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
}

module.exports = groupsRoutes;