import fp from 'fastify-plugin';
import { jwtVerify, type JWTPayload } from 'jose';

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
  permissions?: {
    canCreateJobs: boolean;
    canExport: boolean;
    canManageWebhooks: boolean;
    canManageSchedules: boolean;
    canManageTeam: boolean;
    quotaJobs: number | null;
    quotaExports: number | null;
  };
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser;
  }
  interface FastifyInstance {
    authenticate: (
      request: import('fastify').FastifyRequest,
      reply: import('fastify').FastifyReply
    ) => Promise<void>;
    requirePermission: (
      permission: keyof NonNullable<AuthUser['permissions']>
    ) => (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>;
  }
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

export async function signJwt(payload: AuthUser): Promise<string> {
  const { SignJWT } = await import('jose');
  const expiresIn = process.env.JWT_EXPIRES_IN ?? '7d';

  return new SignJWT({ ...payload } as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecret());
}

export const authPlugin = fp(
  async (fastify) => {
    fastify.decorateRequest('user', null as unknown as AuthUser);

    const authenticate = async (
      request: import('fastify').FastifyRequest,
      reply: import('fastify').FastifyReply
    ) => {
      try {
        // Check cookie first, then Authorization header
        const token =
          request.cookies?.token ??
          request.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return reply.status(401).send({ error: 'Authentication required' });
        }

        const { payload } = await jwtVerify(token, getJwtSecret());
        const userId = payload.userId as string;

        // Load user with permissions from DB
        const user = await fastify.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            role: true,
            canCreateJobs: true,
            canExport: true,
            canManageWebhooks: true,
            canManageSchedules: true,
            canManageTeam: true,
            quotaJobs: true,
            quotaExports: true,
          },
        });

        if (!user) {
          return reply.status(401).send({ error: 'User not found' });
        }

        request.user = {
          userId,
          email: payload.email as string,
          role: payload.role as string,
          permissions: {
            canCreateJobs: user.canCreateJobs,
            canExport: user.canExport,
            canManageWebhooks: user.canManageWebhooks,
            canManageSchedules: user.canManageSchedules,
            canManageTeam: user.canManageTeam,
            quotaJobs: user.quotaJobs,
            quotaExports: user.quotaExports,
          },
        };
      } catch {
        return reply.status(401).send({ error: 'Invalid or expired token' });
      }
    };

    const requirePermission = (permission: keyof NonNullable<AuthUser['permissions']>) => {
      return async (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => {
        // Owners bypass permission checks
        if (request.user.role === 'OWNER') return;

        const perm = request.user.permissions?.[permission];
        if (perm === false || perm === undefined) {
          return reply.status(403).send({ error: `Permission denied: ${permission}` });
        }
      };
    };

    fastify.decorate('authenticate', authenticate);
    fastify.decorate('requirePermission', requirePermission);
  },
  { name: 'auth-plugin' }
);
