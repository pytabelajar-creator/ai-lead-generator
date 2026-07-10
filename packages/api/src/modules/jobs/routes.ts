import type { FastifyPluginAsync } from 'fastify';
import { createJobSchema, jobFilterSchema } from '@leadgen/shared';
import { createScrapeQueue } from '@leadgen/queue';
import type { Prisma } from '@leadgen/db';

export const jobRoutes: FastifyPluginAsync = async (fastify) => {
  const scrapeQueue = createScrapeQueue();

  fastify.post('/', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const parsed = createJobSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.format() });
    }

    const { type, input } = parsed.data;

    // Verify AI config exists before allowing jobs
    const aiConfig = await fastify.prisma.aIConfig.findUnique({
      where: { userId: request.user.userId },
    });

    if (!aiConfig) {
      return reply.status(400).send({ error: 'AI Configuration must be set up before creating jobs' });
    }

    const job = await fastify.prisma.job.create({
      data: {
        type,
        input: input as any, // Cast to any for Prisma Json compat
        userId: request.user.userId,
        status: 'QUEUED',
      },
    });

    await scrapeQueue.add('scrape', {
      jobId: job.id,
      type,
      input,
      userId: request.user.userId,
    });

    return { job };
  });

  fastify.get('/', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const parsed = jobFilterSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid filters', details: parsed.error.format() });
    }

    const {
      status,
      type,
      page,
      limit,
      startDate,
      endDate,
      createdAfter,
      createdBefore,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = parsed.data;

    const skip = (page - 1) * limit;

    const where: Prisma.JobWhereInput = {
      userId: request.user.userId,
      ...(status && { status }),
      ...(type && { type }),
    };

    // Date range filters
    if (startDate || endDate || createdAfter || createdBefore) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
      if (createdAfter) where.createdAt.gte = new Date(createdAfter);
      if (createdBefore) where.createdAt.lte = new Date(createdBefore);
    }

    // Valid sort fields
    const validSortFields = ['createdAt', 'updatedAt', 'status', 'type'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [jobs, total] = await Promise.all([
      fastify.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [safeSortBy]: sortOrder },
        include: {
          _count: {
            select: { leads: true },
          },
        },
      }),
      fastify.prisma.job.count({ where }),
    ]);

    return {
      data: jobs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

  fastify.get('/:id', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await fastify.prisma.job.findFirst({
      where: { id, userId: request.user.userId },
      include: {
        _count: {
          select: { leads: true },
        },
      },
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return { job };
  });

  fastify.delete('/:id', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await fastify.prisma.job.findFirst({
      where: { id, userId: request.user.userId },
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    if (job.status === 'RUNNING') {
      return reply.status(400).send({ error: 'Cannot delete a running job. Cancel it first.' });
    }

    await fastify.prisma.job.delete({
      where: { id },
    });

    return { success: true };
  });

  fastify.post('/:id/cancel', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await fastify.prisma.job.findFirst({
      where: { id, userId: request.user.userId },
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    if (job.status !== 'QUEUED' && job.status !== 'RUNNING') {
      return reply.status(400).send({ error: 'Only queued or running jobs can be cancelled' });
    }

    const updatedJob = await fastify.prisma.job.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return { job: updatedJob };
  });

  fastify.post('/:id/retry', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await fastify.prisma.job.findFirst({
      where: { id, userId: request.user.userId },
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    if (job.status !== 'FAILED' && job.status !== 'CANCELLED') {
      return reply.status(400).send({ error: 'Only failed or cancelled jobs can be retried' });
    }

    // Retry limit check (max 3 retries)
    const MAX_RETRIES = 3;
    if (job.retryCount >= MAX_RETRIES) {
      return reply.status(400).send({
        error: `Maximum retry limit (${MAX_RETRIES}) reached. This job cannot be retried anymore.`,
        retryCount: job.retryCount,
        maxRetries: MAX_RETRIES,
      });
    }

    const updatedJob = await fastify.prisma.job.update({
      where: { id },
      data: {
        status: 'QUEUED',
        error: null,
        retryCount: job.retryCount + 1
      },
    });

    await scrapeQueue.add('scrape', {
      jobId: job.id,
      type: job.type,
      input: job.input as Record<string, unknown>,
      userId: request.user.userId,
    });

    return {
      job: updatedJob,
      message: `Job queued for retry (attempt ${updatedJob.retryCount + 1}/${MAX_RETRIES + 1})`,
    };
  });
};
