import type { FastifyPluginAsync } from 'fastify';

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/stats', { preValidation: [fastify.authenticate] }, async (request) => {
    const userId = request.user.userId;

    const [
      totalLeads,
      totalJobs,
      completedJobs,
      failedJobs,
      runningJobs,
      highPriorityLeads,
    ] = await Promise.all([
      fastify.prisma.lead.count({ where: { job: { userId } } }),
      fastify.prisma.job.count({ where: { userId } }),
      fastify.prisma.job.count({ where: { userId, status: 'COMPLETED' } }),
      fastify.prisma.job.count({ where: { userId, status: 'FAILED' } }),
      fastify.prisma.job.count({ where: { userId, status: 'RUNNING' } }),
      fastify.prisma.lead.count({ where: { job: { userId }, priority: 'HIGH' } }),
    ]);

    const successRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

    const avgLeadScoreResult = await fastify.prisma.lead.aggregate({
      where: { job: { userId } },
      _avg: { leadScore: true },
    });

    // Group leads by priority for charts
    const leadsByPriorityGroup = await fastify.prisma.lead.groupBy({
      by: ['priority'],
      where: { job: { userId }, priority: { not: null } },
      _count: { id: true },
    });

    const leadsByPriority = leadsByPriorityGroup.map(item => ({
      name: item.priority,
      value: item._count.id
    }));

    // Group leads by status for CRM charts
    const leadsByStatusGroup = await fastify.prisma.lead.groupBy({
      by: ['status'],
      where: { job: { userId } },
      _count: { id: true },
    });

    const leadsByStatus = leadsByStatusGroup.map(item => ({
      name: item.status,
      value: item._count.id
    }));

    // Leads over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const leadsByDateGroup = await fastify.prisma.lead.groupBy({
      by: ['createdAt'],
      where: {
        job: { userId },
        createdAt: { gte: thirtyDaysAgo }
      },
      _count: { id: true },
    });

    // Aggregate by day
    const leadsByDay: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      leadsByDay[key] = 0;
    }
    leadsByDateGroup.forEach(item => {
      const key = item.createdAt.toISOString().split('T')[0];
      if (leadsByDay[key] !== undefined) {
        leadsByDay[key] += item._count.id;
      }
    });

    const leadsTimeline = Object.entries(leadsByDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Leads by category
    const leadsByCategoryGroup = await fastify.prisma.lead.groupBy({
      by: ['category'],
      where: { job: { userId }, category: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const leadsByCategory = leadsByCategoryGroup.map(item => ({
      name: item.category || 'Unknown',
      value: item._count.id
    }));

    // Conversion funnel: NEW -> CONTACTED -> QUALIFIED -> NEGOTIATION -> CONVERTED
    const funnel = await fastify.prisma.lead.groupBy({
      by: ['status'],
      where: { job: { userId } },
      _count: { id: true },
    });

    const funnelOrder = ['NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATION', 'CONVERTED'];
    const conversionFunnel = funnelOrder.map(status => {
      const found = funnel.find(f => f.status === status);
      return {
        stage: status,
        count: found?._count.id || 0,
      };
    });

    return {
      totalLeads,
      totalJobs,
      successRate,
      runningJobs,
      completedJobs,
      failedJobs,
      avgLeadScore: avgLeadScoreResult._avg.leadScore || 0,
      highPriorityLeads,
      charts: {
        leadsByPriority,
        leadsByStatus,
        leadsTimeline,
        leadsByCategory,
        conversionFunnel,
      }
    };
  });
};
