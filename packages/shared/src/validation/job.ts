import { z } from 'zod';

export const gmapsJobInputSchema = z.object({
  keyword: z.string().min(2, 'Keyword must be at least 2 characters'),
  location: z.string().optional(),
  maxResults: z.number().int().min(1).max(100).default(10),
  headless: z.boolean().default(true),
  scrollLimit: z.number().int().min(1).max(50).default(10),
});

export const instagramJobInputSchema = z.object({
  username: z.string().optional(),
  searchKeyword: z.string().optional(),
}).refine(
  (data) => data.username || data.searchKeyword,
  { message: 'Either username or searchKeyword must be provided' }
);

export const createJobSchema = z.object({
  type: z.enum(['GMAPS', 'INSTAGRAM']),
  input: z.union([gmapsJobInputSchema, instagramJobInputSchema]),
});

export const jobFilterSchema = z.object({
  status: z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  type: z.enum(['GMAPS', 'INSTAGRAM']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // Date range filters
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional(),    // ISO date string
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  // Sorting
  sortBy: z.enum(['createdAt', 'updatedAt', 'status', 'type']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type CreateJobSchema = z.infer<typeof createJobSchema>;
export type JobFilterSchema = z.infer<typeof jobFilterSchema>;
