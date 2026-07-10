import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import type { Browser } from 'playwright';
import type { InstagramInput, InstagramResult } from './types.js';
import { extractMetaTags } from './meta-parser.js';
import { extractEmail, extractPhone, extractSocialHandles } from './bio-parser.js';

chromium.use(stealth());

export type { InstagramInput, InstagramResult };

export class InstagramScraper {
  private browser: Browser | null = null;
  private shouldStop = false;

  validate(input: InstagramInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!input.username && !input.searchKeyword) {
      errors.push('Either username or searchKeyword must be provided');
    }
    if (input.username && input.username.startsWith('@')) {
      input.username = input.username.substring(1);
    }
    return { valid: errors.length === 0, errors };
  }

  async start(input: InstagramInput): Promise<InstagramResult[]> {
    this.shouldStop = false;
    const validation = this.validate(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    this.browser = await chromium.launch({
      headless: true,
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

      // Block heavy resources for speed
      await page.route('**/*.{png,jpg,jpeg,gif,webp,mp4,woff2}', (route) =>
        route.abort()
      );

      if (input.username) {
        // Direct profile scrape
        const result = await this.scrapeProfile(page, input.username);
        return result ? [result] : [];
      }

      // Search keyword — not implemented yet (requires login)
      throw new Error(
        'Instagram search by keyword requires authentication and is not supported in this version. Please provide a username instead.'
      );
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

  normalize(results: InstagramResult[]): InstagramResult[] {
    return results.filter((r) => r.username && r.username.length > 0);
  }

  private async scrapeProfile(
    page: import('playwright').Page,
    username: string
  ): Promise<InstagramResult | null> {
    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Check for login wall
    if (page.url().includes('/accounts/login')) {
      throw new Error(
        `Login wall encountered for @${username}. Profile may be private or Instagram is blocking access.`
      );
    }

    // Wait for page to load
    await page.waitForSelector('header', { timeout: 10000 }).catch(() => {
      throw new Error(
        `Could not load profile for @${username}. The profile may not exist.`
      );
    });

    // Extract meta tags (most stable data source)
    const meta = await extractMetaTags(page);

    // Extract bio from header
    const bio = await page
      .locator('header section div span')
      .allTextContents()
      .then((texts) => {
        const filtered = texts.filter(
          (t) =>
            t.length > 10 &&
            !t.includes('Followers') &&
            !t.includes('Following') &&
            !t.includes('Posts')
        );
        return filtered[0]?.trim() ?? null;
      })
      .catch(() => null);

    // Extract website link
    const website = await page
      .locator('header a[rel*="nofollow"]')
      .first()
      .getAttribute('href')
      .catch(() => null);

    // Check verified badge
    const isVerified = await page
      .locator('header svg[aria-label="Verified"]')
      .isVisible()
      .catch(() => false);

    // Business category
    const businessCategory = await page
      .locator('header div[class*="category"], header a[class*="category"]')
      .first()
      .textContent()
      .then((t) => t?.trim() ?? null)
      .catch(() => null);

    // Full name from og:title or header
    let fullName: string | null = null;
    if (meta.title) {
      const nameMatch = meta.title.match(/^(.+?)\s*\(@/);
      if (nameMatch) fullName = nameMatch[1].trim();
    }

    // Latest post URLs
    const latestPostUrls = await page
      .locator('article a[href*="/p/"], main a[href*="/p/"]')
      .evaluateAll((els: HTMLAnchorElement[]) =>
        els.map((el) => el.href).slice(0, 12)
      )
      .catch(() => [] as string[]);

    // Extract contact info from bio
    const email = bio ? extractEmail(bio) : null;
    const phone = bio ? extractPhone(bio) : null;

    // Extract social handles from bio
    const socialHandles = bio ? extractSocialHandles(bio) : null;

    // Determine digital presence
    const hasWebsite = !!(website && website !== 'https://www.instagram.com/');
    const hasWhatsApp = !!socialHandles?.whatsapp;
    const hasTelegram = !!socialHandles?.telegram;

    return {
      username,
      fullName,
      bio,
      website,
      followersCount: meta.followersCount,
      followingCount: meta.followingCount,
      postsCount: meta.postsCount,
      isVerified,
      isBusinessAccount: !!businessCategory || (meta.followersCount !== null && meta.followersCount > 1000),
      businessCategory,
      profilePicUrl: meta.image,
      latestPostUrls,
      email: email || null,
      phone: phone || socialHandles?.whatsapp || null,
      whatsapp: socialHandles?.whatsapp || null,
      telegram: socialHandles?.telegram || null,
    };
  }
}
