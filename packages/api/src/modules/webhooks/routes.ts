import type { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /webhooks - List all webhooks
  fastify.get('/', { preValidation: [fastify.authenticate] }, async (request) => {
    const webhooks = await fastify.prisma.webhook.findMany({
      where: { userId: request.user.userId },
      select: {
        id: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: webhooks };
  });

  // POST /webhooks - Create a new webhook
  fastify.post('/', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { url, events, secret } = request.body as {
      url: string;
      events: string[];
      secret?: string;
    };

    // Validate URL
    try {
      new URL(url);
    } catch {
      return reply.status(400).send({ error: 'Invalid webhook URL' });
    }

    // Validate events
    const validEvents = ['JOB_COMPLETED', 'JOB_FAILED', 'JOB_STARTED', 'LEAD_CREATED'];
    const invalidEvents = events.filter(e => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return reply.status(400).send({
        error: 'Invalid events',
        validEvents,
        invalidEvents,
      });
    }

    // Generate secret if not provided
    const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

    const webhook = await fastify.prisma.webhook.create({
      data: {
        userId: request.user.userId,
        url,
        events,
        secret: webhookSecret,
        isActive: true,
      },
      select: {
        id: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
      },
    });

    return {
      webhook,
      secret: webhookSecret, // Only returned on creation
      warning: 'Store this secret securely. It will not be shown again.',
    };
  });

  // PATCH /webhooks/:id - Update webhook
  fastify.patch('/:id', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { url, events, isActive } = request.body as {
      url?: string;
      events?: string[];
      isActive?: boolean;
    };

    const webhook = await fastify.prisma.webhook.findFirst({
      where: { id, userId: request.user.userId },
    });

    if (!webhook) {
      return reply.status(404).send({ error: 'Webhook not found' });
    }

    const updateData: any = {};
    if (url !== undefined) {
      try {
        new URL(url);
        updateData.url = url;
      } catch {
        return reply.status(400).send({ error: 'Invalid webhook URL' });
      }
    }
    if (events !== undefined) {
      const validEvents = ['JOB_COMPLETED', 'JOB_FAILED', 'JOB_STARTED', 'LEAD_CREATED'];
      const invalidEvents = events.filter(e => !validEvents.includes(e));
      if (invalidEvents.length > 0) {
        return reply.status(400).send({ error: 'Invalid events', validEvents });
      }
      updateData.events = events;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const updated = await fastify.prisma.webhook.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        url: true,
        events: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return { webhook: updated };
  });

  // DELETE /webhooks/:id - Delete webhook
  fastify.delete('/:id', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const webhook = await fastify.prisma.webhook.findFirst({
      where: { id, userId: request.user.userId },
    });

    if (!webhook) {
      return reply.status(404).send({ error: 'Webhook not found' });
    }

    await fastify.prisma.webhook.delete({
      where: { id },
    });

    return { success: true, message: 'Webhook deleted' };
  });

  // POST /webhooks/:id/test - Test webhook delivery
  fastify.post('/:id/test', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const webhook = await fastify.prisma.webhook.findFirst({
      where: { id, userId: request.user.userId },
    });

    if (!webhook) {
      return reply.status(404).send({ error: 'Webhook not found' });
    }

    // Send test payload
    const testPayload = {
      event: 'TEST',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
        webhookId: webhook.id,
      },
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': 'TEST',
      };

      if (webhook.secret) {
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(JSON.stringify(testPayload))
          .digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return reply.status(400).send({
          success: false,
          error: `Webhook returned status ${response.status}`,
          responseText: await response.text().catch(() => ''),
        });
      }

      return {
        success: true,
        message: 'Test webhook delivered successfully',
        responseStatus: response.status,
      };
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: `Failed to deliver webhook: ${error.message}`,
      });
    }
  });
};

// Function to send webhook notifications (called from workers)
export async function sendWebhookNotification(
  prisma: any,
  userId: string,
  event: string,
  data: any
): Promise<void> {
  const webhooks = await prisma.webhook.findMany({
    where: {
      userId,
      isActive: true,
      events: {
        has: event,
      },
    },
  });

  for (const webhook of webhooks) {
    try {
      const payload = {
        event,
        timestamp: new Date().toISOString(),
        data,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
      };

      if (webhook.secret) {
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(JSON.stringify(payload))
          .digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      console.error(`Failed to send webhook to ${webhook.url}:`, error);
    }
  }
}
