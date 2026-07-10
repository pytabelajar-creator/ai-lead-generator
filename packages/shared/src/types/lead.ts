export type LeadPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface LeadData {
  businessName: string | null;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  coordinates: { lat: number; lng: number } | null;
  googleMapsUrl: string | null;
  imageUrls: string[] | null;
  openingHours: Record<string, string> | null;
}

export interface AIAnalysisResult {
  leadScore: number;
  priority: LeadPriority;
  summary: string;
  recommendedServices: string;
  painPoints: string;
  coldEmail: string;
  whatsappMessage: string;
}

export interface LeadResponse {
  id: string;
  jobId: string;
  rawData: Record<string, unknown>;
  aiAnalysis: AIAnalysisResult | null;
  businessName: string | null;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  leadScore: number | null;
  priority: LeadPriority | null;
  summary: string | null;
  recommendedServices: string | null;
  painPoints: string | null;
  coldEmail: string | null;
  whatsappMessage: string | null;
  status?: string;
  createdAt: string;
}

export interface LeadFilters {
  jobId?: string;
  priority?: LeadPriority;
  minScore?: number;
  maxScore?: number;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'leadScore' | 'createdAt' | 'businessName';
  sortOrder?: 'asc' | 'desc';
}
