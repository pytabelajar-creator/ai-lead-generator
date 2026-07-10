import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(process.cwd(), '../../.env') });
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { prismaPlugin } from './plugins/prisma.js';
import { authPlugin } from './plugins/auth.js';
import { authRoutes } from './modules/auth/routes.js';
import { dashboardRoutes } from './modules/dashboard/routes.js';
import { jobRoutes } from './modules/jobs/routes.js';
import { leadRoutes } from './modules/leads/routes.js';
import { aiConfigRoutes } from './modules/ai-config/routes.js';
import { exportRoutes } from './modules/export/routes.js';
import { healthRoutes } from './modules/health/routes.js';
import { usersRoutes } from './modules/users/routes.js';
import { notificationRoutes } from './modules/notifications/routes.js';
import { webhookRoutes } from './modules/webhooks/routes.js';
import { scheduledJobRoutes } from './modules/scheduled-jobs/routes.js';
import { communicationRoutes } from './modules/communication/routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // Plugins
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  await app.register(cookie);

  // Rate limiting - per user if authenticated, else per IP
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // Use user ID if authenticated, otherwise use IP
      if (request.user?.userId) {
        return `user:${request.user.userId}`;
      }
      return `ip:${request.ip}`;
    },
    errorResponseBuilder: (request, context) => {
      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. You can make up to ${context.max} requests per minute. Please wait and try again.`,
        retryAfter: context.after,
      };
    },
  });

  await app.register(prismaPlugin);
  await app.register(authPlugin);

  // Routes
  await app.register(healthRoutes, { prefix: '/api/health' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  await app.register(jobRoutes, { prefix: '/api/jobs' });
  await app.register(leadRoutes, { prefix: '/api/leads' });
  await app.register(aiConfigRoutes, { prefix: '/api/ai-config' });
  await app.register(exportRoutes, { prefix: '/api/export' });
  await app.register(usersRoutes, { prefix: '/api/users' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });
  await app.register(webhookRoutes, { prefix: '/api/webhooks' });
  await app.register(scheduledJobRoutes, { prefix: '/api/scheduled-jobs' });
  await app.register(communicationRoutes, { prefix: '/api' });

  return app;
}
