import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { loginSchema, registerSchema } from '@leadgen/shared';
import { signJwt } from '../../plugins/auth.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.format() });
    }

    const { email, password } = parsed.data;

    const user = await fastify.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = await signJwt({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    };
  });

  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { success: true };
  });

  fastify.get('/me', { preValidation: [fastify.authenticate] }, async (request) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { id: true, email: true, name: true, role: true },
    });
    
    if (!user) throw new Error('User not found');
    return { user };
  });
};
