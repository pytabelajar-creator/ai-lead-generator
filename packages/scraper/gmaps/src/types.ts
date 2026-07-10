export interface GmapsInput {
  keyword: string;
  location?: string;
  maxResults: number;
  scrollLimit: number;
  headless: boolean;
}

export interface DigitalPresence {
  hasWebsite: boolean;
  hasInstagram: boolean;
  hasFacebook: boolean;
  hasLinkedIn: boolean;
  hasWhatsApp: boolean;
  hasTelegram: boolean;
}

export interface GmapsResult {
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
