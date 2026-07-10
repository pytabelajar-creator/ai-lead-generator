import type { FastifyPluginAsync } from 'fastify';
import exceljs from 'exceljs';
import type { Prisma } from '@leadgen/db';
import type { LeadPriority } from '@leadgen/shared';

interface ExportQuery {
  jobId?: string;
  priority?: string;
  minScore?: string;
  maxScore?: string;
  hasWebsite?: string;
  hasEmail?: string;
  hasPhone?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export const exportRoutes: FastifyPluginAsync = async (fastify) => {
  // Export as Excel
  fastify.get('/excel', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as ExportQuery;
    const { jobId, priority, minScore, maxScore, hasWebsite, hasEmail, hasPhone, search, startDate, endDate } = query;

    // Security: Require either jobId or explicit date range
    if (!jobId && !startDate && !endDate) {
      return reply.status(400).send({
        error: 'jobId or date range (startDate/endDate) is required for security reasons'
      });
    }

    const where = buildWhereClause(request.user.userId, { jobId, priority, minScore, maxScore, hasWebsite, hasEmail, hasPhone, search, startDate, endDate });

    const leads = await fastify.prisma.lead.findMany({
      where,
      orderBy: { leadScore: 'desc' },
      select: {
        businessName: true,
        category: true,
        rating: true,
        reviewCount: true,
        phone: true,
        website: true,
        address: true,
        leadScore: true,
        priority: true,
        summary: true,
        recommendedServices: true,
        painPoints: true,
        email: true,
        instagram: true,
        facebook: true,
        coldEmail: true,
        whatsappMessage: true,
      },
    });

    const workbook = new exceljs.Workbook();
    const sheet = workbook.addWorksheet('Leads');

    sheet.columns = [
      { header: 'Business Name', key: 'businessName', width: 30 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Priority', key: 'priority', width: 12 },
      { header: 'Score', key: 'leadScore', width: 8 },
      { header: 'Phone', key: 'phone', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Website', key: 'website', width: 40 },
      { header: 'Address', key: 'address', width: 45 },
      { header: 'Rating', key: 'rating', width: 8 },
      { header: 'Reviews', key: 'reviewCount', width: 10 },
      { header: 'Instagram', key: 'instagram', width: 25 },
      { header: 'Facebook', key: 'facebook', width: 25 },
      { header: 'Summary', key: 'summary', width: 50 },
      { header: 'Pain Points', key: 'painPoints', width: 50 },
      { header: 'Recommended Services', key: 'recommendedServices', width: 40 },
      { header: 'Cold Email', key: 'coldEmail', width: 60 },
      { header: 'WhatsApp Message', key: 'whatsappMessage', width: 40 },
    ];

    leads.forEach((lead) => {
      sheet.addRow({
        businessName: lead.businessName || '',
        category: lead.category || '',
        priority: lead.priority || '',
        leadScore: lead.leadScore || 0,
        phone: lead.phone || '',
        email: lead.email || '',
        website: lead.website || '',
        address: lead.address || '',
        rating: lead.rating || '',
        reviewCount: lead.reviewCount || 0,
        instagram: lead.instagram || '',
        facebook: lead.facebook || '',
        summary: lead.summary || '',
        painPoints: lead.painPoints || '',
        recommendedServices: lead.recommendedServices || '',
        coldEmail: lead.coldEmail || '',
        whatsappMessage: lead.whatsappMessage || '',
      });
    });

    if (jobId) {
      await fastify.prisma.exportHistory.create({
        data: {
          jobId,
          userId: request.user.userId,
          format: 'EXCEL',
          filePath: 'direct_download',
          rowCount: leads.length,
        },
      }).catch(err => fastify.log.error(err));
    }

    const buffer = await workbook.xlsx.writeBuffer();

    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="leads_export_${jobId || 'filtered'}_${Date.now()}.xlsx"`)
      .send(buffer);
  });

  // Export as CSV
  fastify.get('/csv', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as ExportQuery;
    const { jobId, priority, minScore, maxScore, hasWebsite, hasEmail, hasPhone, search, startDate, endDate } = query;

    if (!jobId && !startDate && !endDate) {
      return reply.status(400).send({
        error: 'jobId or date range (startDate/endDate) is required for security reasons'
      });
    }

    const where = buildWhereClause(request.user.userId, { jobId, priority, minScore, maxScore, hasWebsite, hasEmail, hasPhone, search, startDate, endDate });

    const leads = await fastify.prisma.lead.findMany({
      where,
      orderBy: { leadScore: 'desc' },
      select: {
        businessName: true,
        category: true,
        phone: true,
        email: true,
        website: true,
        address: true,
        leadScore: true,
        priority: true,
        rating: true,
        reviewCount: true,
        instagram: true,
        facebook: true,
        summary: true,
        painPoints: true,
        recommendedServices: true,
        coldEmail: true,
        whatsappMessage: true,
      },
    });

    // Build CSV content
    const headers = ['Business Name', 'Category', 'Priority', 'Score', 'Phone', 'Email', 'Website', 'Address', 'Rating', 'Reviews', 'Instagram', 'Facebook', 'Summary', 'Pain Points', 'Recommended Services', 'Cold Email', 'WhatsApp Message'];
    const rows = leads.map(lead => [
      escapeCsv(lead.businessName),
      escapeCsv(lead.category),
      escapeCsv(lead.priority),
      String(lead.leadScore || ''),
      escapeCsv(lead.phone),
      escapeCsv(lead.email),
      escapeCsv(lead.website),
      escapeCsv(lead.address),
      String(lead.rating || ''),
      String(lead.reviewCount || ''),
      escapeCsv(lead.instagram),
      escapeCsv(lead.facebook),
      escapeCsv(lead.summary),
      escapeCsv(lead.painPoints),
      escapeCsv(lead.recommendedServices),
      escapeCsv(lead.coldEmail),
      escapeCsv(lead.whatsappMessage),
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    if (jobId) {
      await fastify.prisma.exportHistory.create({
        data: {
          jobId,
          userId: request.user.userId,
          format: 'CSV',
          filePath: 'direct_download',
          rowCount: leads.length,
        },
      }).catch(err => fastify.log.error(err));
    }

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="leads_export_${jobId || 'filtered'}_${Date.now()}.csv"`)
      .send(Buffer.from('﻿' + csvContent, 'utf-8')); // BOM for Excel UTF-8
  });

  // Export as JSON
  fastify.get('/json', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as ExportQuery;
    const { jobId, priority, minScore, maxScore, hasWebsite, hasEmail, hasPhone, search, startDate, endDate } = query;

    if (!jobId && !startDate && !endDate) {
      return reply.status(400).send({
        error: 'jobId or date range (startDate/endDate) is required for security reasons'
      });
    }

    const where = buildWhereClause(request.user.userId, { jobId, priority, minScore, maxScore, hasWebsite, hasEmail, hasPhone, search, startDate, endDate });

    const leads = await fastify.prisma.lead.findMany({
      where,
      orderBy: { leadScore: 'desc' },
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedBy: request.user.userId,
      totalLeads: leads.length,
      filters: { jobId, priority, minScore, maxScore, hasWebsite, hasEmail, hasPhone, search },
      leads: leads.map(lead => ({
        businessName: lead.businessName,
        category: lead.category,
        phone: lead.phone,
        email: lead.email,
        website: lead.website,
        address: lead.address,
        leadScore: lead.leadScore,
        priority: lead.priority,
        rating: lead.rating,
        reviewCount: lead.reviewCount,
        instagram: lead.instagram,
        facebook: lead.facebook,
        summary: lead.summary,
        painPoints: lead.painPoints,
        recommendedServices: lead.recommendedServices,
        coldEmail: lead.coldEmail,
        whatsappMessage: lead.whatsappMessage,
        rawData: lead.rawData,
        createdAt: lead.createdAt,
      })),
    };

    if (jobId) {
      await fastify.prisma.exportHistory.create({
        data: {
          jobId,
          userId: request.user.userId,
          format: 'JSON',
          filePath: 'direct_download',
          rowCount: leads.length,
        },
      }).catch(err => fastify.log.error(err));
    }

    reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="leads_export_${jobId || 'filtered'}_${Date.now()}.json"`)
      .send(JSON.stringify(exportData, null, 2));
  });

  // Export history
  fastify.get('/history', { preValidation: [fastify.authenticate] }, async (request) => {
    const history = await fastify.prisma.exportHistory.findMany({
      where: { userId: request.user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        job: {
          select: { type: true },
        },
      },
    });

    return { data: history };
  });
};

// Helper function to build Prisma where clause
function buildWhereClause(
  userId: string,
  filters: {
    jobId?: string;
    priority?: string;
    minScore?: string;
    maxScore?: string;
    hasWebsite?: string;
    hasEmail?: string;
    hasPhone?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }
): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {
    job: { userId },
  };

  if (filters.jobId) where.jobId = filters.jobId;
  if (filters.priority) where.priority = filters.priority as LeadPriority;

  if (filters.minScore || filters.maxScore) {
    where.leadScore = {};
    if (filters.minScore) where.leadScore.gte = parseInt(filters.minScore, 10);
    if (filters.maxScore) where.leadScore.lte = parseInt(filters.maxScore, 10);
  }

  // New filters
  if (filters.hasWebsite === 'true') where.website = { not: null };
  if (filters.hasWebsite === 'false') where.website = null;
  if (filters.hasEmail === 'true') where.email = { not: null };
  if (filters.hasEmail === 'false') where.email = null;
  if (filters.hasPhone === 'true') where.phone = { not: null };
  if (filters.hasPhone === 'false') where.phone = null;

  // Date range filter (for leads created in this period)
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
  }

  if (filters.search) {
    where.OR = [
      { businessName: { contains: filters.search, mode: 'insensitive' } },
      { category: { contains: filters.search, mode: 'insensitive' } },
      { summary: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

// Helper function to escape CSV values
function escapeCsv(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
