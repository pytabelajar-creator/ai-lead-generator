import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import pLimit from 'p-limit';
import type { Browser, Page } from 'playwright';
import type { GmapsInput, GmapsResult } from './types.js';
import { SELECTORS } from './selectors.js';
import { parseListingDetail } from './parser.js';

chromium.use(stealth());

export type { GmapsInput, GmapsResult };

export interface GmapsScraperOptions {
  onProgress?: (current: number, total: number, message: string) => void;
}

export class GmapsScraper {
  private browser: Browser | null = null;
  private shouldStop = false;
  private options: GmapsScraperOptions = {};

  setOptions(options: GmapsScraperOptions): void {
    this.options = options;
  }

  validate(input: GmapsInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!input.keyword || input.keyword.trim().length < 2) {
      errors.push('Keyword must be at least 2 characters');
    }
    if (input.maxResults < 1 || input.maxResults > 100) {
      errors.push('maxResults must be between 1 and 100');
    }
    if (input.scrollLimit < 1 || input.scrollLimit > 50) {
      errors.push('scrollLimit must be between 1 and 50');
    }
    return { valid: errors.length === 0, errors };
  }

  async start(input: GmapsInput): Promise<GmapsResult[]> {
    this.shouldStop = false;
    const validation = this.validate(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    this.browser = await chromium.launch({
      headless: input.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const context = await this.browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        locale: 'en-US',
      });

      const page = await context.newPage();

      // Navigate and search
      const searchQuery = input.location
        ? `${input.keyword} ${input.location}`
        : input.keyword;

      this.options.onProgress?.(0, input.maxResults, 'Starting Google Maps search...');

      await page.goto(
        `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`,
        { waitUntil: 'domcontentloaded', timeout: 30000 }
      );

      this.options.onProgress?.(0, input.maxResults, 'Page loaded, handling consent...');

      // Handle cookie consent
      const acceptBtn = page.locator(SELECTORS.COOKIE_ACCEPT);
      if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await acceptBtn.click();
        await page.waitForTimeout(1000);
      }

      // Wait for results feed
      this.options.onProgress?.(0, input.maxResults, 'Waiting for search results...');
      await page.waitForSelector(SELECTORS.RESULTS_FEED, { timeout: 15000 });

      // Scroll to load results
      this.options.onProgress?.(0, input.maxResults, `Scrolling results (limit: ${input.scrollLimit})...`);
      await this.scrollResults(page, input.scrollLimit);

      // Extract listing URLs
      this.options.onProgress?.(0, input.maxResults, 'Extracting listing URLs...');
      const urls = await this.extractListingUrls(page, input.maxResults);
      const totalListings = urls.length;

      this.options.onProgress?.(0, totalListings, `Found ${totalListings} listings, starting to scrape...`);

      // Close main search page as we don't need it anymore
      await page.close();

      // Visit each listing concurrently with a limit
      const results: GmapsResult[] = [];
      const limit = pLimit(5); // max 5 concurrent tabs
      let processedCount = 0;

      const tasks = urls.map((url) => limit(async () => {
        if (this.shouldStop) return;
        let listingPage: Page | null = null;
        try {
          listingPage = await context.newPage();

          // Abort heavy requests for faster scraping on details
          await listingPage.route('**/*.{png,jpg,jpeg,gif,webp,mp4,woff2,css}', route => route.abort());

          await listingPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          const result = await parseListingDetail(listingPage);
          results.push(result);

          processedCount++;
          const progressPercent = Math.round((processedCount / totalListings) * 100);
          this.options.onProgress?.(processedCount, totalListings, `Scraped: ${result.businessName || 'Unknown'}`);

        } catch (error) {
          processedCount++;
          console.error(`Failed to scrape listing: ${url}`, error instanceof Error ? error.message : 'Unknown error');
        } finally {
          if (listingPage) await listingPage.close().catch(() => {});
        }
      }));

      await Promise.allSettled(tasks);

      this.options.onProgress?.(results.length, totalListings, `Scraping complete: ${results.length} leads extracted`);

      return this.normalize(results);
    } finally {
      await this.stop();
    }
  }

  async stop(): Promise<void> {
    this.shouldStop = true;
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  normalize(results: GmapsResult[]): GmapsResult[] {
    return results.filter((r) => r.businessName && r.businessName.length > 0);
  }

  private async scrollResults(page: Page, maxScrolls: number): Promise<void> {
    const feed = page.locator(SELECTORS.RESULTS_FEED);
    let previousHeight = 0;

    for (let i = 0; i < maxScrolls; i++) {
      if (this.shouldStop) break;

      const currentHeight = await feed.evaluate((el) => el.scrollHeight);
      if (currentHeight === previousHeight) break;

      await feed.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await page.waitForTimeout(2000 + Math.random() * 1000);
      previousHeight = currentHeight;

      // Check for end of list
      const endText = await page
        .locator(SELECTORS.END_OF_LIST)
        .allTextContents()
        .catch(() => [] as string[]);
      if (endText.some((t) => t.includes("You've reached the end"))) break;
    }
  }

  private async extractListingUrls(page: Page, maxResults: number): Promise<string[]> {
    const links = await page.locator(SELECTORS.LISTING_LINK).all();
    const urls: string[] = [];
    for (const link of links) {
      const href = await link.getAttribute('href');
      if (href) urls.push(href);
    }
    return [...new Set(urls)].slice(0, maxResults);
  }
}
