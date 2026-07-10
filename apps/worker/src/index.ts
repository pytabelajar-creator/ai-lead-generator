import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(process.cwd(), '../../.env') });
import { Worker } from 'bullmq';
import { getConnectionOptions } from '@leadgen/queue';
import { processScrapeJob } from './processors/scrape.js';
import { processAnalyzeJob } from './processors/analyze.js';

const SCRAPE_QUEUE = 'scrape-queue';
const ANALYZE_QUEUE = 'analyze-queue';

async function start() {
  console.log('🚀 Starting worker process...');

  const connection = getConnectionOptions();

  const scrapeWorker = new Worker(SCRAPE_QUEUE, processScrapeJob, {
    connection,
    concurrency: parseInt(process.env.SCRAPE_CONCURRENCY || '2', 10),
    limiter: {
      max: 1,
      duration: 1000,
    },
  });

  const analyzeWorker = new Worker(ANALYZE_QUEUE, processAnalyzeJob, {
    connection,
    concurrency: parseInt(process.env.ANALYZE_CONCURRENCY || '5', 10),
  });

  // Logging
  scrapeWorker.on('completed', (job) => console.log(`✅ Scrape Job ${job.id} completed.`));
  scrapeWorker.on('failed', (job, err) => console.error(`❌ Scrape Job ${job?.id} failed:`, err));

  analyzeWorker.on('completed', (job) => console.log(`✅ Analyze Job ${job.id} completed.`));
  analyzeWorker.on('failed', (job, err) => console.error(`❌ Analyze Job ${job?.id} failed:`, err));

  // Graceful shutdown
  const shutdown = async () => {
    console.log('🛑 Shutting down workers...');
    await Promise.all([scrapeWorker.close(), analyzeWorker.close()]);
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch(console.error);
