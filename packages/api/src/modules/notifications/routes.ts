import type { FastifyPluginAsync } from 'fastify';

// A simple in-memory event emitter or array to hold connected clients
export const clients: Array<{ userId: string, send: (data: any) => void }> = [];

export function notifyUser(userId: string, event: string, data: any) {
  const userClients = clients.filter(c => c.userId === userId);
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  userClients.forEach(client => client.send(payload));
}

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/stream', { preValidation: [fastify.authenticate] }, (request, reply) => {
    const userId = request.user.userId;

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    // flush headers
    reply.raw.flushHeaders();

    const send = (data: string) => {
      reply.raw.write(data);
    };

    // Initial heartbeat
    send(`: heartbeat\n\n`);

    const client = { userId, send };
    clients.push(client);

    request.raw.on('close', () => {
      const index = clients.indexOf(client);
      if (index !== -1) {
        clients.splice(index, 1);
      }
    });
  });
};
