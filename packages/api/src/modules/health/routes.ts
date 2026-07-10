import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  fastify.get('/db', async (request, reply) => {
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ status: 'error', database: 'disconnected' });
    }
  });
};
