export function extractEmail(text: string): string | null {
  // More comprehensive email regex
  const match = text.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
  return match ? match[0] : null;
}

export function extractPhone(text: string): string | null {
  // Match various phone formats including WhatsApp numbers
  const match = text.match(
    /(\+?\d{1,4}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,9})/
  );
  return match ? match[0].trim() : null;
}

export function extractSocialHandles(text: string): {
  instagram: string | null;
  whatsapp: string | null;
  telegram: string | null;
  website: string | null;
} {
  const result = {
    instagram: null as string | null,
    whatsapp: null as string | null,
    telegram: null as string | null,
    website: null as string | null,
  };

  // WhatsApp - various formats
  const waPatterns = [
    /(?:wa\.me\/|whatsapp\.com\/s\/|whatsapp:)([0-9]+)/i,
    /(?:WhatsApp|WA|wa)[:\s]*([0-9+\s-]{8,20})/i,
  ];
  for (const pattern of waPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.whatsapp = match[1].replace(/\D/g, '');
      break;
    }
  }

  // Telegram
  const tgMatch = text.match(/(?:t\.me\/|telegram:)([a-zA-Z0-9_]+)/i);
  if (tgMatch) result.telegram = tgMatch[1];

  // Instagram (if different from current profile)
  const igMatch = text.match(/(?:@|ig:|instagram\.com\/)([a-zA-Z0-9._]+)/i);
  if (igMatch && !igMatch[1].toLowerCase().includes('explore') && !igMatch[1].toLowerCase().includes('reels')) {
    result.instagram = igMatch[1].replace(/[\/\?#].*$/, '');
  }

  // Website (排除社交媒体)
  const webMatch = text.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/\S*)?)/i);
  if (webMatch) {
    const domain = webMatch[1].toLowerCase();
    // Skip social media domains
    const socialDomains = ['instagram.com', 'facebook.com', 'twitter.com', 'tiktok.com', 'linkedin.com', 'youtube.com'];
    if (!socialDomains.some(d => domain.includes(d))) {
      result.website = webMatch[0].startsWith('http') ? webMatch[0] : `https://${webMatch[0]}`;
    }
  }

  return result;
}

export function parseStatNumber(str: string): number | null {
  if (!str) return null;
  str = str.replace(/,/g, '');
  const multipliers: Record<string, number> = {
    K: 1_000,
    M: 1_000_000,
    B: 1_000_000_000,
  };
  const match = str.match(/^([\d.]+)([KMB])?$/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const mult = match[2] ? multipliers[match[2].toUpperCase()] : 1;
  return Math.round(num * mult);
}
