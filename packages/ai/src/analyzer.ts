import { createAIClient } from './client.js';
import { DEFAULT_SYSTEM_PROMPT, buildAnalysisPrompt } from './prompts.js';
import type { AIClientConfig, LeadAnalysis, AnalysisResult } from './types.js';

export async function analyzeLead(
  config: AIClientConfig,
  scrapedData: Record<string, unknown>
): Promise<AnalysisResult> {
  try {
    const client = createAIClient(config);
    const systemPrompt = config.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const userMessage = buildAnalysisPrompt(scrapedData);

    const message = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    // Get text from response (ignore thinking blocks)
    const textBlock = message.content.find(
      block => block.type === 'text' && block.text
    );
    let responseText = textBlock?.text ?? '';

    // Clean response - remove any thinking content that might be included
    responseText = responseText.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    responseText = responseText.replace(/^```json\s*/m, '').replace(/\s*```$/m, '');

    // Parse JSON from response
    let jsonText = responseText.trim();

    // Try to extract JSON if wrapped in markdown
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    let analysis: LeadAnalysis;
    try {
      analysis = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse AI response. Response text was:', responseText.substring(0, 500));
      throw parseError;
    }

    // Validate required fields
    if (
      typeof analysis.leadScore !== 'number' ||
      !analysis.priority ||
      !analysis.summary
    ) {
      throw new Error('AI response missing required fields');
    }

    // Clamp lead score
    analysis.leadScore = Math.max(0, Math.min(100, analysis.leadScore));

    return {
      success: true,
      analysis,
      error: null,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    };
  } catch (error) {
    const err = error as Error & { status?: number };

    return {
      success: false,
      analysis: null,
      error: `Analysis failed${err.status ? ` (${err.status})` : ''}: ${err.message}`,
      usage: null,
    };
  }
}

export async function analyzeLeadBatch(
  config: AIClientConfig,
  scrapedDataList: Record<string, unknown>[]
): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [];

  for (const data of scrapedDataList) {
    const result = await analyzeLead(config, data);
    results.push(result);

    // Small delay between requests to avoid rate limiting
    if (results.length < scrapedDataList.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}
