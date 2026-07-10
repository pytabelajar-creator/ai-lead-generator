export type JobType = 'GMAPS' | 'INSTAGRAM';

export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface CreateJobInput {
  type: JobType;
  input: GmapsJobInput | InstagramJobInput;
}

export interface GmapsJobInput {
  keyword: string;
  location?: string;
  maxResults: number;
  headless: boolean;
  scrollLimit: number;
}

export interface InstagramJobInput {
  username?: string;
  searchKeyword?: string;
}

export interface JobResponse {
  id: string;
  type: JobType;
  status: JobStatus;
  input: Record<string, unknown>;
  error: string | null;
  progress: number;          // 0-100 percentage
  totalResults: number;      // Total items to scrape
  processedCount: number;    // Items processed so far
  startedAt: string | null;
  completedAt: string | null;
  retryCount: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    leads: number;
  };
}
