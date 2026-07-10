import type { FastifyPluginAsync } from 'fastify';
import cronParser from 'cron-parser';
import { createScrapeQueue } from '@leadgen/queue';
import { z } from 'zod';

const createScheduledJobSchema = z.object({
  type: z.enum(['GMAPS', 'INSTAGRAM']),
  input: z.any(),
  cronExpression: z.string().min(1),
  name: z.string().optional(),
});

export const scheduledJobRoutes: FastifyPluginAsync = async (fastify) => {
  const scrapeQueue = createScrapeQueue();

  // GET /scheduled-jobs - List all scheduled jobs
  fastify.get('/', { preValidation: [fastify.authenticate] }, async (request) => {
    const scheduledJobs = await fastify.prisma.scheduledJob.findMany({
      where: { userId: request.user.userId },
      orderBy: { createdAt: 'desc' },
    });

    return { data: scheduledJobs };
  });

  // POST /scheduled-jobs - Create a new scheduled job
  fastify.post('/', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const parsed = createScheduledJobSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.format(),
      });
    }

    const { type, input, cronExpression, name } = parsed.data;

    // Validate cron expression
    try {
      cronParser.parseExpression(cronExpression);
    } catch {
      return reply.status(400).send({
        error: 'Invalid cron expression',
        hint: 'Use standard cron format: minute hour day-of-month month day-of-week',
        example: '0 9 * * * (runs daily at 9:00 AM)',
      });
    }

    // Calculate next run time
    const interval = cronParser.parseExpression(cronExpression);
    const nextRunAt = interval.next().toDate();

    const scheduledJob = await fastify.prisma.scheduledJob.create({
      data: {
        userId: request.user.userId,
        type,
        input: input as any,
        cronExpression,
        name,
        isActive: true,
        nextRunAt,
      },
    });

    return { scheduledJob };
  });

  // GET /scheduled-jobs/:id - Get single scheduled job
  fastify.get('/:id', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const scheduledJob = await fastify.prisma.scheduledJob.findFirst({
      where: { id, userId: request.user.userId },
    });

    if (!scheduledJob) {
      return reply.status(404).send({ error: 'Scheduled job not found' });
    }

    // Calculate next run
    let nextRunAt: Date | null = null;
    if (scheduledJob.isActive) {
      try {
        const interval = cronParser.parseExpression(scheduledJob.cronExpression);
        nextRunAt = interval.next().toDate();
      } catch {
        // Invalid cron - don't show next run
      }
    }

    return {
      scheduledJob: {
        ...scheduledJob,
        nextRunAt,
      },
    };
  });

  // PATCH /scheduled-jobs/:id - Update scheduled job
  fastify.patch('/:id', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { input, cronExpression, name, isActive } = request.body as any;

    const scheduledJob = await fastify.prisma.scheduledJob.findFirst({
      where: { id, userId: request.user.userId },
    });

    if (!scheduledJob) {
      return reply.status(404).send({ error: 'Scheduled job not found' });
    }

    const updateData: any = {};

    if (input !== undefined) {
      updateData.input = input;
    }

    if (cronExpression !== undefined) {
      try {
        cronParser.parseExpression(cronExpression);
        updateData.cronExpression = cronExpression;

        // Recalculate next run if cron changed
        if (isActive !== false) {
          const interval = cronParser.parseExpression(cronExpression);
          updateData.nextRunAt = interval.next().toDate();
        }
      } catch {
        return reply.status(400).send({ error: 'Invalid cron expression' });
      }
    }

    if (name !== undefined) {
      updateData.name = name;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;

      if (isActive) {
        // Recalculate next run
        const interval = cronParser.parseExpression(scheduledJob.cronExpression);
        updateData.nextRunAt = interval.next().toDate();
      } else {
        updateData.nextRunAt = null;
      }
    }

    const updated = await fastify.prisma.scheduledJob.update({
      where: { id },
      data: updateData,
    });

    return { scheduledJob: updated };
  });

  // DELETE /scheduled-jobs/:id - Delete scheduled job
  fastify.delete('/:id', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const scheduledJob = await fastify.prisma.scheduledJob.findFirst({
      where: { id, userId: request.user.userId },
    });

    if (!scheduledJob) {
      return reply.status(404).send({ error: 'Scheduled job not found' });
    }

    await fastify.prisma.scheduledJob.delete({
      where: { id },
    });

    return { success: true, message: 'Scheduled job deleted' };
  });

  // POST /scheduled-jobs/:id/run - Trigger a scheduled job immediately
  fastify.post('/:id/run', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const scheduledJob = await fastify.prisma.scheduledJob.findFirst({
      where: { id, userId: request.user.userId },
    });

    if (!scheduledJob) {
      return reply.status(404).send({ error: 'Scheduled job not found' });
    }

    if (!scheduledJob.isActive) {
      return reply.status(400).send({ error: 'Scheduled job is disabled' });
    }

    // Create a regular job immediately
    const job = await fastify.prisma.job.create({
      data: {
        type: scheduledJob.type,
        input: scheduledJob.input as any,
        userId: scheduledJob.userId,
        status: 'QUEUED',
      },
    });

    await scrapeQueue.add('scrape', {
      jobId: job.id,
      type: scheduledJob.type,
      input: scheduledJob.input as any,
      userId: scheduledJob.userId,
    });

    // Update last run time
    await fastify.prisma.scheduledJob.update({
      where: { id },
      data: { lastRunAt: new Date() },
    });

    return {
      success: true,
      message: 'Scheduled job triggered successfully',
      jobId: job.id,
    };
  });
};
