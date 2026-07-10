export interface AIClientConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}

export interface LeadAnalysis {
  leadScore: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  businessOpportunity: string;
  recommendedServices: string;
  painPoints: string;
  digitalGap?: string;
  coldEmail: string;
  whatsappMessage: string;
}

export interface AnalysisResult {
  success: boolean;
  analysis: LeadAnalysis | null;
  error: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  } | null;
}

export interface ConnectionTestResult {
  success: boolean;
  model: string | null;
  message: string;
  latencyMs: number;
}
