// tickets/src/routes/tickets.js
const supabase = require('../db');

async function ticketsRoutes(fastify, options) {

  // ============================================
  // TICKETS (CRUD)
  // ============================================

  // GET /tickets - Listar tickets del grupo seleccionado
  fastify.get('/tickets', { preHandler: [require('../middleware/auth').authMiddleware] }, async (request, reply) => {
    const { grupoId } = request.query;
    const userId = request.user.userId;

    if (!grupoId) {
      return reply.code(400).send({
        statusCode: 400,
        intOpCode: 'ERR400',
        data: { error: 'grupoId es requerido' }
      });
    }

    try {
      let query = supabase
        .from('tickets')
        .select(`
          *,
          estados (nombre, color),
          prioridades (nombre, orden),
          autor:autor_id (id, nombre_completo, username),
          asignado:asignado_id (id, nombre_completo, username)
        `)
        .eq('grupo_id', grupoId);

      const { data, error } = await query;

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

  // GET /tickets/:id - Obtener ticket por ID
  fastify.get('/tickets/:id', { preHandler: [require('../middleware/auth').authMiddleware] }, async (request, reply) => {
    const { id } = request.params;

    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          estados (nombre, color),
          prioridades (nombre, orden),
          autor:autor_id (id, nombre_completo, username),
          asignado:asignado_id (id, nombre_completo, username)
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        return reply.code(404).send({
          statusCode: 404,
          intOpCode: 'ERR404',
          data: { error: 'Ticket no encontrado' }
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
        data: { error: 'Error interno del servidor' }
      });
    }
  });

  // POST /tickets - Crear ticket (requiere permiso tickets:add)
  fastify.post('/tickets', { preHandler: [require('../middleware/auth').authMiddleware] }, async (request, reply) => {
    const { grupo_id, titulo, descripcion, asignado_id, prioridad_id, fecha_limite } = request.body;
    const userId = request.user.userId;

    if (!grupo_id || !titulo) {
      return reply.code(400).send({
        statusCode: 400,
        intOpCode: 'ERR400',
        data: { error: 'grupo_id y titulo son requeridos' }
      });
    }

    try {
      // Obtener estado inicial "Pendiente" (id = 1 según script)
      const { data: estadoPendiente } = await supabase
        .from('estados')
        .select('id')
        .eq('nombre', 'Pendiente')
        .single();

      // Obtener prioridad por defecto "Media" (id = 3 según script)
      let prioridadFinal = prioridad_id;
      if (!prioridadFinal) {
        const { data: prioridadMedia } = await supabase
          .from('prioridades')
          .select('id')
          .eq('nombre', 'Media')
          .single();
        prioridadFinal = prioridadMedia?.id || 3;
      }

      const { data: nuevoTicket, error: createError } = await supabase
        .from('tickets')
        .insert({
          grupo_id,
          titulo,
          descripcion: descripcion || null,
          autor_id: userId,
          asignado_id: asignado_id || null,
          estado_id: estadoPendiente?.id || 1,
          prioridad_id: prioridadFinal,
          fecha_limite: fecha_limite || null
        })
        .select()
        .single();

      if (createError) throw createError;

      // Registrar en historial
      await supabase
        .from('historial_tickets')
        .insert({
          ticket_id: nuevoTicket.id,
          usuario_id: userId,
          accion: 'Ticket creado',
          detalles: { titulo, descripcion }
        });

      return reply.code(201).send({
        statusCode: 201,
        intOpCode: 'SxUS201',
        data: nuevoTicket
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

  // PUT /tickets/:id - Editar ticket (requiere permiso tickets:edit o ser creador)
  fastify.put('/tickets/:id', { preHandler: [require('../middleware/auth').authMiddleware] }, async (request, reply) => {
    const { id } = request.params;
    const { titulo, descripcion, asignado_id, prioridad_id, fecha_limite } = request.body;
    const userId = request.user.userId;

    try {
      // Verificar si el ticket existe y obtener autor
      const { data: ticketActual, error: findError } = await supabase
        .from('tickets')
        .select('autor_id')
        .eq('id', id)
        .single();

      if (findError || !ticketActual) {
        return reply.code(404).send({
          statusCode: 404,
          intOpCode: 'ERR404',
          data: { error: 'Ticket no encontrado' }
        });
      }

      const updateData = {};
      if (titulo) updateData.titulo = titulo;
      if (descripcion !== undefined) updateData.descripcion = descripcion;
      if (asignado_id !== undefined) updateData.asignado_id = asignado_id;
      if (prioridad_id) updateData.prioridad_id = prioridad_id;
      if (fecha_limite !== undefined) updateData.fecha_limite = fecha_limite;

      if (Object.keys(updateData).length === 0) {
        return reply.code(400).send({
          statusCode: 400,
          intOpCode: 'ERR400',
          data: { error: 'No hay campos para actualizar' }
        });
      }

      const { data, error } = await supabase
        .from('tickets')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Registrar en historial
      await supabase
        .from('historial_tickets')
        .insert({
          ticket_id: id,
          usuario_id: userId,
          accion: 'Ticket actualizado',
          detalles: updateData
        });

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

  // PATCH /tickets/:id/status - Cambiar estado del ticket (requiere permiso tickets:move Y ser asignado)
  fastify.patch('/tickets/:id/status', { preHandler: [require('../middleware/auth').authMiddleware] }, async (request, reply) => {
    const { id } = request.params;
    const { estado_nombre } = request.body;
    const userId = request.user.userId;

    if (!estado_nombre) {
      return reply.code(400).send({
        statusCode: 400,
        intOpCode: 'ERR400',
        data: { error: 'estado_nombre es requerido' }
      });
    }

    try {
      // Verificar ticket y asignación
      const { data: ticket, error: findError } = await supabase
        .from('tickets')
        .select('asignado_id, autor_id')
        .eq('id', id)
        .single();

      if (findError || !ticket) {
        return reply.code(404).send({
          statusCode: 404,
          intOpCode: 'ERR404',
          data: { error: 'Ticket no encontrado' }
        });
      }

      // Verificar que el usuario sea el asignado o el autor
      if (ticket.asignado_id !== userId && ticket.autor_id !== userId) {
        return reply.code(403).send({
          statusCode: 403,
          intOpCode: 'ERR403',
          data: { error: 'No tienes permiso para mover este ticket' }
        });
      }

      // Obtener nuevo estado
      const { data: nuevoEstado, error: estadoError } = await supabase
        .from('estados')
        .select('id')
        .eq('nombre', estado_nombre)
        .single();

      if (estadoError || !nuevoEstado) {
        return reply.code(400).send({
          statusCode: 400,
          intOpCode: 'ERR400',
          data: { error: 'Estado no válido' }
        });
      }

      const { data, error } = await supabase
        .from('tickets')
        .update({ estado_id: nuevoEstado.id })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('historial_tickets')
        .insert({
          ticket_id: id,
          usuario_id: userId,
          accion: `Estado cambiado a ${estado_nombre}`,
          detalles: { nuevo_estado: estado_nombre }
        });

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

  // DELETE /tickets/:id - Eliminar ticket (requiere permiso tickets:delete o ser creador)
  fastify.delete('/tickets/:id', { preHandler: [require('../middleware/auth').authMiddleware] }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.userId;

    try {
      const { data: ticket, error: findError } = await supabase
        .from('tickets')
        .select('autor_id')
        .eq('id', id)
        .single();

      if (findError || !ticket) {
        return reply.code(404).send({
          statusCode: 404,
          intOpCode: 'ERR404',
          data: { error: 'Ticket no encontrado' }
        });
      }

      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return reply.send({
        statusCode: 200,
        intOpCode: 'SxUS200',
        data: { message: 'Ticket eliminado correctamente' }
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
  // COMENTARIOS
  // ============================================

  // GET /tickets/:id/comments - Obtener comentarios de un ticket
  fastify.get('/tickets/:id/comments', { preHandler: [require('../middleware/auth').authMiddleware] }, async (request, reply) => {
    const { id } = request.params;

    try {
      const { data, error } = await supabase
        .from('comentarios')
        .select(`
          *,
          autor:autor_id (id, nombre_completo, username)
        `)
        .eq('ticket_id', id)
        .order('creado_en', { ascending: true });

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

  // POST /tickets/:id/comments - Agregar comentario
  fastify.post('/tickets/:id/comments', { preHandler: [require('../middleware/auth').authMiddleware] }, async (request, reply) => {
    const { id } = request.params;
    const { contenido } = request.body;
    const userId = request.user.userId;

    if (!contenido) {
      return reply.code(400).send({
        statusCode: 400,
        intOpCode: 'ERR400',
        data: { error: 'El comentario no puede estar vacío' }
      });
    }

    try {
      const { data, error } = await supabase
        .from('comentarios')
        .insert({
          ticket_id: id,
          autor_id: userId,
          contenido
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('historial_tickets')
        .insert({
          ticket_id: id,
          usuario_id: userId,
          accion: 'Comentario agregado',
          detalles: { comentario: contenido.substring(0, 100) }
        });

      return reply.code(201).send({
        statusCode: 201,
        intOpCode: 'SxUS201',
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

  // ============================================
  // HISTORIAL
  // ============================================

  // GET /tickets/:id/history - Obtener historial de cambios
  fastify.get('/tickets/:id/history', { preHandler: [require('../middleware/auth').authMiddleware] }, async (request, reply) => {
    const { id } = request.params;

    try {
      const { data, error } = await supabase
        .from('historial_tickets')
        .select(`
          *,
          usuario:usuario_id (id, nombre_completo, username)
        `)
        .eq('ticket_id', id)
        .order('creado_en', { ascending: false });

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
}

module.exports = ticketsRoutes;