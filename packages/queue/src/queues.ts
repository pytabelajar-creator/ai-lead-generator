import { Queue, FlowProducer } from 'bullmq';
import { getConnectionOptions } from './connection.js';
import type { ScrapeJobData, AnalyzeJobData } from './types.js';

const SCRAPE_QUEUE = 'scrape-queue';
const ANALYZE_QUEUE = 'analyze-queue';

export function createScrapeQueue(): Queue<ScrapeJobData> {
  return new Queue<ScrapeJobData>(SCRAPE_QUEUE, {
    connection: getConnectionOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 86400,
      },
    },
  });
}

export function createAnalyzeQueue(): Queue<AnalyzeJobData> {
  return new Queue<AnalyzeJobData>(ANALYZE_QUEUE, {
    connection: getConnectionOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 86400,
      },
    },
  });
}

export function createFlowProducer(): FlowProducer {
  return new FlowProducer({
    connection: getConnectionOptions(),
  });
}
