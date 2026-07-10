import type { Job } from 'bullmq';
import { prisma } from '@leadgen/db';
import { createAnalyzeQueue, type ScrapeJobData } from '@leadgen/queue';
import { GmapsScraper } from '@leadgen/scraper-gmaps';
import { InstagramScraper } from '@leadgen/scraper-instagram';

export async function processScrapeJob(job: Job<ScrapeJobData>) {
  const { jobId, type, input, userId } = job.data;

  await job.log(`Starting scrape job ${jobId} of type ${type}`);

  // Get maxResults for progress tracking
  const maxResults = (input as any).maxResults || 50;

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
      progress: 0,
      totalResults: maxResults,
      processedCount: 0,
    },
  });

  let scrapedData: any[] = [];

  // Progress callback to update job progress
  const updateProgress = async (current: number, total: number, message: string) => {
    const progress = total > 0 ? Math.round((current / total) * 100) : 0;
    await job.log(`Progress: ${current}/${total} (${progress}%) - ${message}`);

    // Update job in database every few items
    if (current % 5 === 0 || current === total) {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          progress,
          totalResults: total,
          processedCount: current,
        },
      }).catch(() => {}); // Ignore errors in progress update
    }
  };

  try {
    if (type === 'GMAPS') {
      const scraper = new GmapsScraper();
      scraper.setOptions({ onProgress: updateProgress });
      scrapedData = await scraper.start(input as any);
    } else if (type === 'INSTAGRAM') {
      const scraper = new InstagramScraper();
      scrapedData = await scraper.start(input as any);
      await updateProgress(scrapedData.length, scrapedData.length, 'Instagram profile scraped');
    } else {
      throw new Error(`Unsupported job type: ${type}`);
    }

    // Update final progress
    await prisma.job.update({
      where: { id: jobId },
      data: {
        progress: 100,
        totalResults: scrapedData.length,
        processedCount: scrapedData.length,
      },
    }).catch(() => {});

    await job.log(`Scraped ${scrapedData.length} leads. Moving to analyze queue...`);

    // Pass to AI analyzer
    const analyzeQueue = createAnalyzeQueue();
    await analyzeQueue.add('analyze', {
      jobId,
      scrapedData,
      userId,
    });

    return { success: true, leadsScraped: scrapedData.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await job.log(`Scraping failed: ${errorMsg}`);

    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'FAILED', error: errorMsg },
    });

    throw error;
  }
}
