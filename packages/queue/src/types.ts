export interface ScrapeJobData {
  jobId: string;
  type: 'GMAPS' | 'INSTAGRAM';
  input: Record<string, unknown>;
  userId: string;
}

export interface AnalyzeJobData {
  jobId: string;
  scrapedData: Record<string, unknown>[];
  userId: string;
}
