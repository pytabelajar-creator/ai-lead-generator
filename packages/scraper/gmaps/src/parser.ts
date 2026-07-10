import type { Page } from 'playwright';
import type { GmapsResult } from './types.js';
import { SELECTORS } from './selectors.js';

/**
 * Check if a website URL is actually valid and accessible
 * Returns false for placeholder domains like "instagram.com"
 */
function isRealWebsite(websiteUrl: string | null): boolean {
  if (!websiteUrl) return false;

  // Check for placeholder/incomplete URLs
  const placeholderDomains = [
    'instagram.com',
    'facebook.com',
    'twitter.com',
    'tiktok.com',
    'linkedin.com',
    'wa.me',
    'whatsapp.com',
  ];

  try {
    const url = new URL(websiteUrl);
    const hostname = url.hostname.toLowerCase().replace('www.', '');
    return !placeholderDomains.some(d => hostname.includes(d));
  } catch {
    return false;
  }
}

/**
 * Extract social media handles from various text sources
 */
function extractSocialHandles(text: string): {
  instagram: string | null;
  whatsapp: string | null;
  telegram: string | null;
} {
  const result = { instagram: null as string | null, whatsapp: null as string | null, telegram: null as string | null };

  // Instagram handle
  const igMatch = text.match(/(?:@|instagram\.com\/)([a-zA-Z0-9._]+)/i);
  if (igMatch && !igMatch[1].toLowerCase().includes('explore')) {
    result.instagram = igMatch[1].replace(/[\/\?#].*$/, '');
  }

  // WhatsApp
  const waMatch = text.match(/(?:wa\.me\/|whatsapp\.com\/s\/|whatsapp:)([0-9]+)/i);
  if (waMatch) result.whatsapp = waMatch[1];

  // Telegram
  const tgMatch = text.match(/(?:t\.me\/|telegram:)([a-zA-Z0-9_]+)/i);
  if (tgMatch) result.telegram = tgMatch[1];

  return result;
}

export function extractCoordinates(url: string): { lat: number; lng: number } | null {
  const dataMatch = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (dataMatch) {
    return { lat: parseFloat(dataMatch[1]), lng: parseFloat(dataMatch[2]) };
  }
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }
  return null;
}

export async function parseListingDetail(page: Page): Promise<GmapsResult> {
  await page.waitForSelector(SELECTORS.BUSINESS_NAME, { timeout: 10000 });

  const businessName = await page
    .locator(SELECTORS.BUSINESS_NAME)
    .first()
    .textContent()
    .then((t) => t?.trim() ?? '')
    .catch(() => '');

  const category = await page
    .locator(SELECTORS.CATEGORY_BUTTON)
    .first()
    .textContent()
    .then((t) => t?.trim() ?? '')
    .catch(() => '');

  const ratingText = await page
    .locator(SELECTORS.RATING)
    .first()
    .textContent()
    .catch(() => null);
  const rating = ratingText ? parseFloat(ratingText) : null;

  const reviewLabel = await page
    .locator(SELECTORS.REVIEW_COUNT)
    .first()
    .getAttribute('aria-label')
    .catch(() => null);
  const reviewCount = reviewLabel
    ? parseInt(reviewLabel.replace(/[^\d]/g, ''), 10)
    : null;

  const address = await page
    .locator(SELECTORS.ADDRESS)
    .first()
    .textContent()
    .then((t) => t?.trim() ?? null)
    .catch(() => null);

  const phone = await page
    .locator(SELECTORS.PHONE)
    .first()
    .textContent()
    .then((t) => t?.trim() ?? null)
    .catch(() => null);

  // Website from Google Maps listing
  const websiteFromMaps = await page
    .locator(SELECTORS.WEBSITE)
    .first()
    .textContent()
    .then((t) => t?.trim() ?? null)
    .catch(() => null);

  // Determine if real website exists
  const hasRealWebsite = isRealWebsite(websiteFromMaps);

  // Only use website if it's a real website (not social media placeholder)
  const website = hasRealWebsite ? websiteFromMaps : null;

  // Extract social handles from business name, category, and page content
  const allText = [businessName, category, address, websiteFromMaps].filter(Boolean).join(' ');
  const socialHandles = extractSocialHandles(allText);

  // If Instagram handle was found in the text
  const instagramFromText = socialHandles.instagram;

  // WhatsApp from text
  const whatsappFromText = socialHandles.whatsapp;

  let openingHours: Record<string, string> | null = null;
  const hoursButton = page.locator(SELECTORS.HOURS_BUTTON).first();
  if (await hoursButton.isVisible().catch(() => false)) {
    try {
      await hoursButton.click();
      await page.waitForTimeout(1000);
      const rows = await page.locator(SELECTORS.HOURS_TABLE).all();
      if (rows.length > 0) {
        openingHours = {};
        for (const row of rows) {
          const day = await row.locator('td:first-child').textContent().catch(() => '');
          const hours = await row.locator('td:last-child').textContent().catch(() => '');
          if (day && hours) {
            openingHours[day.trim()] = hours.trim();
          }
        }
      }
    } catch {
      // Opening hours extraction failed — non-critical
    }
  }

  const coordinates = extractCoordinates(page.url());

  const imageUrls = await page
    .locator(SELECTORS.IMAGES)
    .evaluateAll((imgs: HTMLImageElement[]) =>
      imgs.map((img) => img.src).filter(Boolean)
    )
    .catch(() => [] as string[]);

  // Only fetch email from website if it's a real website
  let email: string | null = null;
  let linkedin: string | null = null;
  let instagram: string | null = instagramFromText;
  let facebook: string | null = null;
  let telegram: string | null = socialHandles.telegram;
  let whatsapp: string | null = whatsappFromText;

  // Track digital presence
  const digitalPresence = {
    hasWebsite: hasRealWebsite,
    hasInstagram: !!instagram,
    hasFacebook: !!facebook,
    hasLinkedIn: !!linkedin,
    hasWhatsApp: !!whatsapp,
    hasTelegram: !!telegram,
  };

  if (website && hasRealWebsite) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(website, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const html = await response.text();

        // Extract email (basic regex)
        const emailMatch = html.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        if (emailMatch) {
          const foundEmail = emailMatch[1].toLowerCase();
          if (!foundEmail.includes('.png') && !foundEmail.includes('sentry') && !foundEmail.includes('example')) {
            email = foundEmail;
          }
        }

        // Extract LinkedIn
        const lnMatch = html.match(/href="([^"]*linkedin\.com\/(?:company|in)\/[^"]+)"/i);
        if (lnMatch) linkedin = lnMatch[1];

        // Extract Instagram from website
        const igMatch = html.match(/href="([^"]*instagram\.com\/[^"]+)"/i);
        if (igMatch && !instagram) {
          const igUrl = igMatch[1];
          const handleMatch = igUrl.match(/instagram\.com\/([^\/\?]+)/i);
          if (handleMatch) instagram = handleMatch[1];
        }

        // Extract Facebook from website
        const fbMatch = html.match(/href="([^"]*facebook\.com\/[^"]+)"/i);
        if (fbMatch) facebook = fbMatch[1];
      }
    } catch {
      // Ignore fetch errors
    }
  }

  return {
    businessName,
    category,
    rating,
    reviewCount,
    phone,
    website,
    address,
    coordinates,
    googleMapsUrl: page.url(),
    imageUrls: imageUrls.slice(0, 10),
    openingHours,
    email,
    linkedin,
    instagram,
    facebook,
    telegram,
    whatsapp,
    digitalPresence,
  };
}
