import type { FastifyPluginAsync } from 'fastify';
import { aiConfigSchema } from '@leadgen/shared';
import { encrypt, maskApiKey, decrypt } from '@leadgen/shared';
import { testConnection } from '@leadgen/ai';

export const aiConfigRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preValidation: [fastify.authenticate] }, async (request) => {
    const config = await fastify.prisma.aIConfig.findUnique({
      where: { userId: request.user.userId },
    });

    if (!config) return { config: null };

    return {
      config: {
        id: config.id,
        endpoint: config.endpoint,
        apiKeyMasked: maskApiKey(config.apiKey),
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        systemPrompt: config.systemPrompt,
      },
    };
  });

  fastify.put('/', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const putSchema = aiConfigSchema.extend({ apiKey: aiConfigSchema.shape.apiKey.optional() });
    const parsed = putSchema.safeParse(request.body);
    
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.format() });
    }

    const existing = await fastify.prisma.aIConfig.findUnique({
      where: { userId: request.user.userId },
    });

    let encryptedApiKey: string;
    if (parsed.data.apiKey) {
      encryptedApiKey = encrypt(parsed.data.apiKey);
    } else if (existing) {
      encryptedApiKey = existing.apiKey;
    } else {
      return reply.status(400).send({ error: 'Validation failed', details: { apiKey: { _errors: ['API key is required'] } } });
    }

    try {
      const config = await fastify.prisma.aIConfig.upsert({
        where: { userId: request.user.userId },
        update: {
          endpoint: parsed.data.endpoint,
          apiKey: encryptedApiKey,
          model: parsed.data.model,
          temperature: parsed.data.temperature,
          maxTokens: parsed.data.maxTokens,
          systemPrompt: parsed.data.systemPrompt,
        },
        create: {
          userId: request.user.userId,
          endpoint: parsed.data.endpoint,
          apiKey: encryptedApiKey,
          model: parsed.data.model,
          temperature: parsed.data.temperature,
          maxTokens: parsed.data.maxTokens,
          systemPrompt: parsed.data.systemPrompt,
        },
      });

      return {
        config: {
          id: config.id,
          endpoint: config.endpoint,
          apiKeyMasked: maskApiKey(parsed.data.apiKey || '********'),
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          systemPrompt: config.systemPrompt,
        },
      };
    } catch (e: any) {
      request.log.error(e);
      console.error('UPSERT ERROR:', e);
      return reply.status(500).send({ error: e.message || 'Internal Server Error' });
    }
  });

  fastify.post('/test', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const testSchema = aiConfigSchema.extend({ apiKey: aiConfigSchema.shape.apiKey.optional() });
    const parsed = testSchema.safeParse(request.body);
    
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.format() });
    }

    try {
      let apiKeyToTest = parsed.data.apiKey;
      if (!apiKeyToTest) {
        const config = await fastify.prisma.aIConfig.findUnique({ where: { userId: request.user.userId } });
        if (config && config.apiKey) {
          apiKeyToTest = decrypt(config.apiKey);
        } else {
          return reply.status(400).send({ error: 'API key is required' });
        }
      }

      const result = await testConnection({
        endpoint: parsed.data.endpoint,
        apiKey: apiKeyToTest,
        model: parsed.data.model,
        temperature: parsed.data.temperature || 0.3,
        maxTokens: parsed.data.maxTokens || 50,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.message || 'Connection test failed' });
      }

      return { success: true, message: 'Connection successful!' };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || 'Failed to test connection' });
    }
  });

  fastify.post('/models', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as any;
    if (!body?.endpoint) {
      return reply.status(400).send({ error: 'Endpoint is required' });
    }

    try {
      let baseUrl = body.endpoint;
      if (!baseUrl.endsWith('/')) baseUrl += '/';
      
      let modelsUrl = baseUrl + 'v1/models';
      if (baseUrl.includes('/v1/')) {
        modelsUrl = baseUrl.replace(/\/v1\/.*$/, '/v1/models');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      let apiKey = body.apiKey;
      let decryptedApiKey = '';

      // If apiKey is empty or masked, try to get from db
      if (!apiKey || apiKey.includes('***')) {
        const config = await fastify.prisma.aIConfig.findUnique({
          where: { userId: request.user.userId },
        });
        if (config && config.apiKey) {
          decryptedApiKey = decrypt(config.apiKey);
        }
      } else {
        decryptedApiKey = apiKey;
      }

      if (decryptedApiKey) {
        headers['Authorization'] = `Bearer ${decryptedApiKey}`;
      }

      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        return reply.status(response.status).send({ error: `Failed to fetch models: ${response.statusText}` });
      }

      const data = await response.json() as any;
      if (data && Array.isArray(data.data)) {
        const models = data.data.map((m: any) => m.id);
        return { success: true, models };
      }
      
      return reply.status(400).send({ error: 'Unrecognized format from gateway.' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || 'Failed to fetch models' });
    }
  });

  // DELETE /ai-config - Delete AI configuration
  fastify.delete('/', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const config = await fastify.prisma.aIConfig.findUnique({
      where: { userId: request.user.userId },
    });

    if (!config) {
      return reply.status(404).send({ error: 'AI configuration not found' });
    }

    await fastify.prisma.aIConfig.delete({
      where: { id: config.id },
    });

    return { success: true, message: 'AI configuration deleted' };
  });
};
