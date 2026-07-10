export { createAIClient, testConnection } from './client.js';
export { analyzeLead, analyzeLeadBatch } from './analyzer.js';
export { DEFAULT_SYSTEM_PROMPT, buildAnalysisPrompt } from './prompts.js';
export type {
  AIClientConfig,
  LeadAnalysis,
  AnalysisResult,
  ConnectionTestResult,
} from './types.js';
