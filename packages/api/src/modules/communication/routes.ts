import type { FastifyPluginAsync } from 'fastify';
import nodemailer from 'nodemailer';

export const communicationRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /communication/email/config - Get email config status
  fastify.get('/communication/email/config', { preValidation: [fastify.authenticate] }, async () => {
    const hasSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    return {
      configured: hasSmtp,
      provider: hasSmtp ? (process.env.SMTP_PROVIDER || 'custom') : null,
    };
  });

  // POST /communication/email/send - Send cold email (queued via bullmq or direct SMTP)
  fastify.post('/communication/email/send', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { leadId, to, subject, body } = request.body as {
      leadId?: string;
      to: string;
      subject: string;
      body: string;
    };

    if (!to || !subject || !body) {
      return reply.status(400).send({ error: 'to, subject, and body are required' });
    }

    // Verify lead ownership if leadId provided
    if (leadId) {
      const lead = await fastify.prisma.lead.findFirst({
        where: { id: leadId, job: { userId: request.user.userId } },
      });
      if (!lead) {
        return reply.status(404).send({ error: 'Lead not found' });
      }
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    } as nodemailer.TransportOptions);

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text: body,
        html: body.replace(/\n/g, '<br>'),
      });

      // Track in DB if leadId provided
      if (leadId) {
        await fastify.prisma.lead.update({
          where: { id: leadId },
          data: {
            emailSent: true,
            emailSentAt: new Date(),
          },
        });
      }

      return {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
      };
    } catch (error: any) {
      fastify.log.error('Email send failed:', error);
      return reply.status(500).send({
        error: 'Failed to send email',
        details: error.message,
      });
    }
  });

  // POST /communication/whatsapp/send - Send WhatsApp via Twilio
  fastify.post('/communication/whatsapp/send', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { leadId, to, message } = request.body as {
      leadId?: string;
      to: string;
      message: string;
    };

    if (!to || !message) {
      return reply.status(400).send({ error: 'to and message are required' });
    }

    // Verify lead ownership if leadId provided
    if (leadId) {
      const lead = await fastify.prisma.lead.findFirst({
        where: { id: leadId, job: { userId: request.user.userId } },
      });
      if (!lead) {
        return reply.status(404).send({ error: 'Lead not found' });
      }
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

    if (!accountSid || !authToken || !fromNumber) {
      return reply.status(503).send({
        error: 'WhatsApp not configured',
        message: 'Twilio credentials not set in environment variables',
      });
    }

    try {
      const twilio = (await import('twilio')).default;
      const client = twilio(accountSid, authToken);

      // Clean phone number
      const cleanPhone = to.replace(/\D/g, '');
      const finalPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.substring(1) : cleanPhone;

      const result = await client.messages.create({
        body: message,
        from: fromNumber,
        to: `whatsapp:+${finalPhone}`,
      });

      // Track in DB if leadId provided
      if (leadId) {
        await fastify.prisma.lead.update({
          where: { id: leadId },
          data: {
            whatsappSent: true,
            whatsappSentAt: new Date(),
          },
        });
      }

      return {
        success: true,
        sid: result.sid,
        status: result.status,
      };
    } catch (error: any) {
      fastify.log.error('WhatsApp send failed:', error);
      return reply.status(500).send({
        error: 'Failed to send WhatsApp message',
        details: error.message,
      });
    }
  });

  // POST /communication/whatsapp/webhook - Twilio webhook for delivery status
  fastify.post('/communication/whatsapp/webhook', { preValidation: [] }, async (request) => {
    const body = request.body as Record<string, string>;
    const messageSid = body.MessageSid;
    const messageStatus = body.MessageStatus;

    if (messageSid && messageStatus) {
      fastify.log.info(`WhatsApp message ${messageSid} status: ${messageStatus}`);
      // Could update lead record here if we stored the SID
    }

    return { received: true };
  });

  // GET /communication/templates - Get saved templates
  fastify.get('/communication/templates', { preValidation: [fastify.authenticate] }, async (request) => {
    // Return default templates or user-defined ones
    return {
      templates: [
        {
          id: 'cold-email-default',
          name: 'Cold Email Template',
          type: 'email',
          content: 'Halo [Nama Bisnis],\n\nSaya tertarik dengan bisnis Anda...',
        },
        {
          id: 'whatsapp-default',
          name: 'WhatsApp Intro Template',
          type: 'whatsapp',
          content: 'Halo! Saya dari [Perusahaan]...',
        },
      ],
    };
  });
};
