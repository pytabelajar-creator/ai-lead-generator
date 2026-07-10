export interface AIConfigInput {
  endpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}

export interface AIConfigResponse {
  id: string;
  endpoint: string;
  apiKeyMasked: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string | null;
}
