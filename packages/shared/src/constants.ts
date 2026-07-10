export const QUEUE_NAMES = {
  SCRAPE: 'scrape-queue',
  ANALYZE: 'analyze-queue',
} as const;

export const JOB_DEFAULTS = {
  MAX_RETRIES: 3,
  BACKOFF_TYPE: 'exponential' as const,
  BACKOFF_DELAY: 1000,
  REMOVE_ON_COMPLETE_AGE: 3600,
  REMOVE_ON_COMPLETE_COUNT: 1000,
  REMOVE_ON_FAIL_AGE: 86400,
};

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
};

export const SCRAPER_DEFAULTS = {
  TIMEOUT: 30000,
  MAX_RESULTS: 10,
  SCROLL_LIMIT: 10,
  HEADLESS: true,
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
};

export const AI_DEFAULTS = {
  MODEL: 'claude-sonnet-4-20250514',
  TEMPERATURE: 0.3,
  MAX_TOKENS: 4096,
  MAX_RETRIES: 3,
  TIMEOUT: 60000,
};
