export interface ScraperConfig {
  headless: boolean;
  timeout: number;
  userAgent?: string;
}

export interface DigitalPresence {
  hasWebsite: boolean;
  hasInstagram: boolean;
  hasFacebook: boolean;
  hasLinkedIn: boolean;
  hasWhatsApp: boolean;
  hasTelegram: boolean;
}

export interface GmapsScraperInput {
  keyword: string;
  location?: string;
  maxResults: number;
  scrollLimit: number;
  headless: boolean;
}

export interface GmapsScraperOutput {
  businessName: string;
  category: string;
  rating: number | null;
  reviewCount: number | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  coordinates: { lat: number; lng: number } | null;
  googleMapsUrl: string;
  imageUrls: string[];
  openingHours: Record<string, string> | null;
  email?: string | null;
  linkedin?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  telegram?: string | null;
  whatsapp?: string | null;
  digitalPresence?: DigitalPresence;
}

export interface InstagramScraperInput {
  username?: string;
  searchKeyword?: string;
}

export interface InstagramScraperOutput {
  username: string;
  fullName: string | null;
  bio: string | null;
  website: string | null;
  followersCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  isVerified: boolean;
  isBusinessAccount: boolean;
  businessCategory: string | null;
  profilePicUrl: string | null;
  latestPostUrls: string[];
  email: string | null;
  phone: string | null;
}

export interface ScraperModule<TInput, TOutput> {
  start(input: TInput, config: ScraperConfig): Promise<TOutput[]>;
  stop(): Promise<void>;
  validate(input: TInput): { valid: boolean; errors: string[] };
  normalize(raw: unknown[]): TOutput[];
}
