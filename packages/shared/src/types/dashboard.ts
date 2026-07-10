export interface DashboardStats {
  totalLeads: number;
  totalJobs: number;
  successRate: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  avgLeadScore: number;
  highPriorityLeads: number;
  charts?: {
    leadsByPriority: Array<{ name: string; value: number }>;
    leadsByStatus: Array<{ name: string; value: number }>;
    leadsTimeline?: Array<{ date: string; count: number }>;
    leadsByCategory?: Array<{ name: string; value: number }>;
    conversionFunnel?: Array<{ stage: string; count: number }>;
  };
}
