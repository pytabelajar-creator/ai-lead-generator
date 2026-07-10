import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@leadgen/db';
import type { LeadPriority } from '@leadgen/shared';

export const leadRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /leads - List leads with advanced filters
  fastify.get('/', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const {
      jobId,
      priority,
      minScore,
      maxScore,
      search,
      noWebsite,
      hasWebsite,
      hasEmail,
      hasPhone,
      hasInstagram,
      page = '1',
      limit = '20',
      sortBy = 'leadScore',
      sortOrder = 'desc',
      startDate,
      endDate,
    } = request.query as Record<string, string>;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.LeadWhereInput = {
      job: { userId: request.user.userId },
    };

    if (jobId) where.jobId = jobId;
    if (priority) where.priority = priority as LeadPriority;

    // Website filters
    if (noWebsite === 'true') {
      where.website = null;
    } else if (hasWebsite === 'true') {
      where.website = { not: null };
    } else if (hasWebsite === 'false') {
      where.website = null;
    }

    // Email filters
    if (hasEmail === 'true') {
      where.email = { not: null };
    } else if (hasEmail === 'false') {
      where.email = null;
    }

    // Phone filters
    if (hasPhone === 'true') {
      where.phone = { not: null };
    } else if (hasPhone === 'false') {
      where.phone = null;
    }

    // Instagram filter
    if (hasInstagram === 'true') {
      where.instagram = { not: null };
    } else if (hasInstagram === 'false') {
      where.instagram = null;
    }

    // Score filters
    if (minScore || maxScore) {
      where.leadScore = {};
      if (minScore) where.leadScore.gte = parseInt(minScore, 10);
      if (maxScore) where.leadScore.lte = parseInt(maxScore, 10);
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Search
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Validate sortBy field
    const validSortFields = ['leadScore', 'createdAt', 'businessName', 'rating', 'reviewCount', 'priority'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'leadScore';

    const [leads, total] = await Promise.all([
      fastify.prisma.lead.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [safeSortBy]: sortOrder === 'asc' ? 'asc' : 'desc' },
      }),
      fastify.prisma.lead.count({ where }),
    ]);

    return {
      data: leads,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  });

  // GET /leads/:id - Get single lead
  fastify.get('/:id', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const lead = await fastify.prisma.lead.findFirst({
      where: { id, job: { userId: request.user.userId } },
    });

    if (!lead) {
      return reply.status(404).send({ error: 'Lead not found' });
    }

    return { lead };
  });

  // PATCH /leads/:id - Update lead
  fastify.patch('/:id', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, priority, businessName, phone, email, website, address, coldEmail, whatsappMessage, summary, painPoints, recommendedServices } = request.body as any;

    const lead = await fastify.prisma.lead.findFirst({
      where: { id, job: { userId: request.user.userId } },
    });

    if (!lead) {
      return reply.status(404).send({ error: 'Lead not found' });
    }

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (businessName !== undefined) updateData.businessName = businessName;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (website !== undefined) updateData.website = website;
    if (address !== undefined) updateData.address = address;
    if (coldEmail !== undefined) updateData.coldEmail = coldEmail;
    if (whatsappMessage !== undefined) updateData.whatsappMessage = whatsappMessage;
    if (summary !== undefined) updateData.summary = summary;
    if (painPoints !== undefined) updateData.painPoints = painPoints;
    if (recommendedServices !== undefined) updateData.recommendedServices = recommendedServices;

    const updatedLead = await fastify.prisma.lead.update({
      where: { id },
      data: updateData,
    });

    return { lead: updatedLead };
  });

  // PATCH /leads/:id/status - Update single lead status
  fastify.patch('/:id/status', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: any };

    const lead = await fastify.prisma.lead.findFirst({
      where: { id, job: { userId: request.user.userId } },
    });

    if (!lead) {
      return reply.status(404).send({ error: 'Lead not found' });
    }

    const updatedLead = await fastify.prisma.lead.update({
      where: { id },
      data: { status }
    });

    return { lead: updatedLead };
  });

  // PATCH /leads/bulk-status - Bulk update lead status
  fastify.patch('/bulk-status', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { leadIds, status } = request.body as { leadIds: string[]; status: string };

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return reply.status(400).send({ error: 'leadIds array is required' });
    }

    if (!status) {
      return reply.status(400).send({ error: 'status is required' });
    }

    // Verify ownership of all leads
    const leads = await fastify.prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        job: { userId: request.user.userId },
      },
      select: { id: true },
    });

    const ownedIds = leads.map(l => l.id);
    const notOwned = leadIds.filter(id => !ownedIds.includes(id));

    if (ownedIds.length === 0) {
      return reply.status(404).send({ error: 'No leads found' });
    }

    // Update only owned leads
    const updatedCount = await fastify.prisma.lead.updateMany({
      where: { id: { in: ownedIds } },
      data: { status: status as 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'NEGOTIATION' | 'CONVERTED' | 'LOST' },
    });

    return {
      success: true,
      updatedCount: updatedCount.count,
      notOwnedCount: notOwned.length > 0 ? notOwned.length : undefined,
      message: `Updated ${updatedCount.count} leads`,
    };
  });

  // DELETE /leads/:id - Delete single lead
  fastify.delete('/:id', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const lead = await fastify.prisma.lead.findFirst({
      where: { id, job: { userId: request.user.userId } },
    });

    if (!lead) {
      return reply.status(404).send({ error: 'Lead not found' });
    }

    await fastify.prisma.lead.delete({
      where: { id },
    });

    return { success: true, message: 'Lead deleted' };
  });

  // DELETE /leads/bulk - Bulk delete leads
  fastify.delete('/bulk', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { leadIds } = request.body as { leadIds: string[] };

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return reply.status(400).send({ error: 'leadIds array is required' });
    }

    // Verify ownership
    const leads = await fastify.prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        job: { userId: request.user.userId },
      },
      select: { id: true },
    });

    if (leads.length === 0) {
      return reply.status(404).send({ error: 'No leads found' });
    }

    const deletedCount = await fastify.prisma.lead.deleteMany({
      where: { id: { in: leads.map(l => l.id) } },
    });

    return {
      success: true,
      deletedCount: deletedCount.count,
      message: `Deleted ${deletedCount.count} leads`,
    };
  });

  // GET /leads/stats - Lead statistics
  fastify.get('/stats/summary', { preValidation: [fastify.authenticate] }, async (request) => {
    const { jobId } = request.query as Record<string, string>;

    const where = {
      job: { userId: request.user.userId },
      ...(jobId && { jobId }),
    };

    const [
      totalLeads,
      withWebsite,
      withoutWebsite,
      withEmail,
      withoutEmail,
      withPhone,
      withoutPhone,
      highPriority,
      mediumPriority,
      lowPriority,
    ] = await Promise.all([
      fastify.prisma.lead.count({ where }),
      fastify.prisma.lead.count({ where: { ...where, website: { not: null } } }),
      fastify.prisma.lead.count({ where: { ...where, website: null } }),
      fastify.prisma.lead.count({ where: { ...where, email: { not: null } } }),
      fastify.prisma.lead.count({ where: { ...where, email: null } }),
      fastify.prisma.lead.count({ where: { ...where, phone: { not: null } } }),
      fastify.prisma.lead.count({ where: { ...where, phone: null } }),
      fastify.prisma.lead.count({ where: { ...where, priority: 'HIGH' } }),
      fastify.prisma.lead.count({ where: { ...where, priority: 'MEDIUM' } }),
      fastify.prisma.lead.count({ where: { ...where, priority: 'LOW' } }),
    ]);

    const avgScore = await fastify.prisma.lead.aggregate({
      where,
      _avg: { leadScore: true },
    });

    return {
      totalLeads,
      website: { with: withWebsite, without: withoutWebsite, percentage: totalLeads > 0 ? Math.round((withWebsite / totalLeads) * 100) : 0 },
      email: { with: withEmail, without: withoutEmail, percentage: totalLeads > 0 ? Math.round((withEmail / totalLeads) * 100) : 0 },
      phone: { with: withPhone, without: withoutPhone, percentage: totalLeads > 0 ? Math.round((withPhone / totalLeads) * 100) : 0 },
      priority: { high: highPriority, medium: mediumPriority, low: lowPriority },
      avgScore: Math.round(avgScore._avg.leadScore || 0),
    };
  });
};
