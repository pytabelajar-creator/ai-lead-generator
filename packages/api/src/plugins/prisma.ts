import fp from 'fastify-plugin';
import { PrismaClient } from '@leadgen/db';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const prismaPlugin = fp(
  async (fastify) => {
    const prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === 'development'
          ? ['error', 'warn']
          : ['error'],
    });

    await prisma.$connect();
    fastify.log.info('📦 Database connected');

    fastify.decorate('prisma', prisma);

    fastify.addHook('onClose', async () => {
      await prisma.$disconnect();
      fastify.log.info('📦 Database disconnected');
    });
  },
  { name: 'prisma-plugin' }
);
