import type { AIClientConfig, ConnectionTestResult } from './types.js';

export interface AIClient {
  messages: {
    create: (params: {
      model: string;
      max_tokens: number;
      temperature?: number;
      system?: string;
      messages: Array<{ role: string; content: string }>;
    }) => Promise<{
      model: string;
      content: Array<{ type: string; text?: string; thinking?: string }>;
      usage: { input_tokens: number; output_tokens: number };
    }>;
  };
}

export function createAIClient(config: AIClientConfig): AIClient {
  let baseURL = config.endpoint.replace(/\/$/, '');
  // Add /v1 for anthropic-compatible endpoints
  if (baseURL.includes('anthropic') && !baseURL.includes('/v1')) {
    baseURL = baseURL + '/v1';
  }
  const apiKey = config.apiKey;

  const makeRequest = async (
    path: string,
    body: Record<string, unknown>
  ): Promise<unknown> => {
    const response = await fetch(`${baseURL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      const err = new Error(`API Error (${response.status}): ${error}`) as Error & {
        status: number;
      };
      err.status = response.status;
      throw err;
    }

    return response.json();
  };

  return {
    messages: {
      create: async (params) => {
        return makeRequest('/messages', params) as Promise<{
          model: string;
          content: Array<{ type: string; text?: string; thinking?: string }>;
          usage: { input_tokens: number; output_tokens: number };
        }>;
      },
    },
  };
}

export async function testConnection(
  config: AIClientConfig
): Promise<ConnectionTestResult> {
  const startTime = Date.now();

  try {
    const client = createAIClient(config);

    const message = await client.messages.create({
      model: config.model,
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: 'Respond with only the word "connected" and nothing else.',
        },
      ],
    });

    const latencyMs = Date.now() - startTime;
    const textBlock = message.content.find((block) => block.type === 'text');
    const responseText = textBlock?.text || '';

    return {
      success: true,
      model: message.model,
      message: `Successfully connected to ${config.model}`,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const err = error as Error & { status?: number };

    return {
      success: false,
      model: null,
      message: `API Error (${err.status || 'Unknown'}): ${err.message}`,
      latencyMs,
    };
  }
}
