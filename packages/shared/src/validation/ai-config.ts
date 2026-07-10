import { z } from 'zod';

export const aiConfigSchema = z.object({
  endpoint: z.string().url('Invalid endpoint URL'),
  apiKey: z.string().min(1, 'API key is required'),
  model: z.string().min(1, 'Model is required'),
  temperature: z.number().min(0).max(2).default(0.3),
  maxTokens: z.number().int().min(100).max(32000).default(4096),
  systemPrompt: z.string().nullable().optional(),
});

export type AIConfigSchema = z.infer<typeof aiConfigSchema>;
