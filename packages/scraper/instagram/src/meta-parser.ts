import type { Page } from 'playwright';
import { parseStatNumber } from './bio-parser.js';

export interface MetaData {
  followersCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  description: string | null;
  title: string | null;
  image: string | null;
}

export async function extractMetaTags(page: Page): Promise<MetaData> {
  const description = await page
    .locator('meta[property="og:description"]')
    .getAttribute('content')
    .catch(() => null);

  const title = await page
    .locator('meta[property="og:title"]')
    .getAttribute('content')
    .catch(() => null);

  const image = await page
    .locator('meta[property="og:image"]')
    .getAttribute('content')
    .catch(() => null);

  let followersCount: number | null = null;
  let followingCount: number | null = null;
  let postsCount: number | null = null;

  if (description) {
    const statsMatch = description.match(
      /([\d,.]+[KMB]?)\s*Followers?,\s*([\d,.]+[KMB]?)\s*Following,\s*([\d,.]+[KMB]?)\s*Posts?/i
    );
    if (statsMatch) {
      followersCount = parseStatNumber(statsMatch[1]);
      followingCount = parseStatNumber(statsMatch[2]);
      postsCount = parseStatNumber(statsMatch[3]);
    }
  }

  return {
    followersCount,
    followingCount,
    postsCount,
    description,
    title,
    image,
  };
}
