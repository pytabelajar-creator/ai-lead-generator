import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /me - Get my profile
  fastify.get('/me', { preValidation: [fastify.authenticate] }, async (request) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { id: true, email: true, name: true, role: true }
    });
    return user;
  });

  // PUT /me - Update my profile
  fastify.put('/me', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { name, email, password } = request.body as any;

    const updateData: any = { name, email };

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await fastify.prisma.user.update({
      where: { id: request.user.userId },
      data: updateData,
      select: { id: true, email: true, name: true, role: true }
    });

    return user;
  });

  // GET / - List all team members (OWNER only)
  fastify.get('/', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({ where: { id: request.user.userId } });
    if (user?.role !== 'OWNER') {
      return reply.code(403).send({ message: 'Only owners can manage team members' });
    }

    const team = await fastify.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });

    return team;
  });

  // POST / - Create a new team member (OWNER only)
  fastify.post('/', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const currentUser = await fastify.prisma.user.findUnique({ where: { id: request.user.userId } });
    if (currentUser?.role !== 'OWNER') {
      return reply.code(403).send({ message: 'Only owners can manage team members' });
    }

    const { name, email, password, role } = request.body as any;

    const existing = await fastify.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(400).send({ message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await fastify.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'SALES'
      },
      select: { id: true, email: true, name: true, role: true }
    });

    return newUser;
  });

  // PATCH /:id/role - Update team member role (OWNER only)
  fastify.patch('/:id/role', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const currentUser = await fastify.prisma.user.findUnique({ where: { id: request.user.userId } });
    if (currentUser?.role !== 'OWNER') {
      return reply.code(403).send({ message: 'Only owners can update team member roles' });
    }

    const { id } = request.params as { id: string };
    const { role } = request.body as { role: string };

    // Cannot change OWNER role or demote yourself
    if (id === currentUser?.id) {
      return reply.code(400).send({ message: 'Cannot change your own role' });
    }

    const targetUser = await fastify.prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return reply.code(404).send({ message: 'User not found' });
    }

    if (targetUser.role === 'OWNER') {
      return reply.code(400).send({ message: 'Cannot change owner role' });
    }

    const updated = await fastify.prisma.user.update({
      where: { id },
      data: { role: role as 'OWNER' | 'SALES' | 'MARKETING' },
      select: { id: true, email: true, name: true, role: true }
    });

    return { user: updated };
  });

  // DELETE /:id - Remove team member (OWNER only)
  fastify.delete('/:id', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const currentUser = await fastify.prisma.user.findUnique({ where: { id: request.user.userId } });
    if (currentUser?.role !== 'OWNER') {
      return reply.code(403).send({ message: 'Only owners can remove team members' });
    }

    const { id } = request.params as { id: string };

    // Cannot delete yourself
    if (id === currentUser?.id) {
      return reply.code(400).send({ message: 'Cannot remove yourself' });
    }

    const targetUser = await fastify.prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return reply.code(404).send({ message: 'User not found' });
    }

    // Cannot delete OWNER
    if (targetUser.role === 'OWNER') {
      return reply.code(400).send({ message: 'Cannot remove owner' });
    }

    await fastify.prisma.user.delete({ where: { id } });

    return { success: true, message: 'User removed' };
  });

  // PUT /:id/permissions - Update user permissions (OWNER only)
  fastify.put('/:id/permissions', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const currentUser = await fastify.prisma.user.findUnique({ where: { id: request.user.userId } });
    if (currentUser?.role !== 'OWNER') {
      return reply.code(403).send({ message: 'Only owners can manage permissions' });
    }

    const { id } = request.params as { id: string };
    const { canCreateJobs, canExport, canManageWebhooks, canManageSchedules, canManageTeam, quotaJobs, quotaExports } = request.body as {
      canCreateJobs?: boolean;
      canExport?: boolean;
      canManageWebhooks?: boolean;
      canManageSchedules?: boolean;
      canManageTeam?: boolean;
      quotaJobs?: number | null;
      quotaExports?: number | null;
    };

    const targetUser = await fastify.prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return reply.code(404).send({ message: 'User not found' });
    }

    if (targetUser.role === 'OWNER') {
      return reply.code(400).send({ message: 'Cannot modify owner permissions' });
    }

    // Persist permissions to DB
    const updated = await fastify.prisma.user.update({
      where: { id },
      data: {
        canCreateJobs: canCreateJobs ?? true,
        canExport: canExport ?? true,
        canManageWebhooks: canManageWebhooks ?? false,
        canManageSchedules: canManageSchedules ?? false,
        canManageTeam: canManageTeam ?? false,
        quotaJobs: quotaJobs ?? null,
        quotaExports: quotaExports ?? null,
      },
    });

    return {
      userId: id,
      permissions: {
        canCreateJobs: updated.canCreateJobs,
        canExport: updated.canExport,
        canManageWebhooks: updated.canManageWebhooks,
        canManageSchedules: updated.canManageSchedules,
        canManageTeam: updated.canManageTeam,
        quotaJobs: updated.quotaJobs,
        quotaExports: updated.quotaExports,
      },
    };
  });

  // GET /:id/permissions - Get user permissions (OWNER only)
  fastify.get('/:id/permissions', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const currentUser = await fastify.prisma.user.findUnique({ where: { id: request.user.userId } });
    if (currentUser?.role !== 'OWNER') {
      return reply.code(403).send({ message: 'Only owners can view permissions' });
    }

    const { id } = request.params as { id: string };

    const targetUser = await fastify.prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return reply.code(404).send({ message: 'User not found' });
    }

    return {
      userId: id,
      role: targetUser.role,
      permissions: {
        canCreateJobs: targetUser.canCreateJobs,
        canExport: targetUser.canExport,
        canManageWebhooks: targetUser.canManageWebhooks,
        canManageSchedules: targetUser.canManageSchedules,
        canManageTeam: targetUser.canManageTeam,
        quotaJobs: targetUser.quotaJobs,
        quotaExports: targetUser.quotaExports,
      },
    };
  });
};
