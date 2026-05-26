// LLM Service Infrastructure
// Provider-agnostic wrapper for multiple LLM providers with caching and error handling

import OpenAI from 'openai';
import NodeCache from 'node-cache';

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  baseURL?: string;
  apiVersion?: string;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  tokensUsed?: number;
  cached?: boolean;
}

export function extractJSONFromLLMResponse(content: string): string | null {
  // Try to find markdown JSON block
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    return jsonMatch[1];
  }
  
  // Find the first { or [ and the last } or ]
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  const firstBracket = content.indexOf('[');
  const lastBracket = content.lastIndexOf(']');
  
  let firstIndex = -1;
  let lastIndex = -1;
  
  if (firstBrace !== -1 && firstBracket !== -1) {
    firstIndex = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    firstIndex = firstBrace;
  } else {
    firstIndex = firstBracket;
  }
  
  if (firstIndex !== -1) {
    if (content[firstIndex] === '{') {
      lastIndex = lastBrace;
    } else {
      lastIndex = lastBracket;
    }
  }
  
  if (firstIndex !== -1 && lastIndex !== -1 && lastIndex > firstIndex) {
    return content.substring(firstIndex, lastIndex + 1);
  }
  
  return null;
}

export interface LLMService {
  chat(messages: LLMMessage[]): Promise<LLMResponse>;
  isAvailable(): boolean;
}

class OpenAILLMService implements LLMService {
  private client: OpenAI | null = null;
  private config: LLMConfig;
  private cache: NodeCache;
  private cacheEnabled: boolean;

  constructor(config: LLMConfig, cache: NodeCache, cacheEnabled: boolean) {
    this.config = config;
    this.cache = cache;
    this.cacheEnabled = cacheEnabled;

    if (config.apiKey) {
      this.client = new OpenAI({
        apiKey: config.apiKey,
      });
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error(
        'OpenAI client not initialized. Check OPENAI_API_KEY environment variable.'
      );
    }

    // Generate cache key from messages
    const cacheKey = this.cacheEnabled
      ? `openai:${this.config.model}:${JSON.stringify(messages)}`
      : null;

    // Check cache
    if (cacheKey && this.cache.has(cacheKey)) {
      const cached = this.cache.get<string>(cacheKey);
      if (cached) {
        return {
          content: cached,
          cached: true,
        };
      }
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        max_tokens: this.config.maxTokens || 2000,
        temperature: this.config.temperature || 0.7,
      });

      const content = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens;

      // Cache the response
      if (cacheKey && content) {
        const ttl = parseInt(process.env.LLM_CACHE_TTL || '3600', 10);
        this.cache.set(cacheKey, content, ttl);
      }

      return {
        content,
        tokensUsed,
        cached: false,
      };
    } catch (error: any) {
      if (error.status === 429) {
        // Rate limit - wait and retry once
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return this.chat(messages);
      }
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }
}

class AnthropicLLMService implements LLMService {
  private config: LLMConfig;
  private cache: NodeCache;
  private cacheEnabled: boolean;

  constructor(config: LLMConfig, cache: NodeCache, cacheEnabled: boolean) {
    this.config = config;
    this.cache = cache;
    this.cacheEnabled = cacheEnabled;
  }

  isAvailable(): boolean {
    return !!this.config.apiKey;
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.config.apiKey) {
      throw new Error(
        'Anthropic API key not configured. Check ANTHROPIC_API_KEY environment variable.'
      );
    }

    // Generate cache key
    const cacheKey = this.cacheEnabled
      ? `anthropic:${this.config.model}:${JSON.stringify(messages)}`
      : null;

    // Check cache
    if (cacheKey && this.cache.has(cacheKey)) {
      const cached = this.cache.get<string>(cacheKey);
      if (cached) {
        return {
          content: cached,
          cached: true,
        };
      }
    }

    try {
      // Dynamically import Anthropic SDK (optional dependency)
      const { Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({
        apiKey: this.config.apiKey,
      });

      // Convert messages format for Anthropic
      const systemMessage = messages.find((m) => m.role === 'system');
      const conversationMessages = messages.filter((m) => m.role !== 'system');

      const response = await client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 2000,
        temperature: this.config.temperature || 0.7,
        system: systemMessage?.content,
        messages: conversationMessages.map((msg) => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        })),
      });

      const content =
        response.content[0]?.type === 'text' ? response.content[0].text : '';
      const tokensUsed =
        response.usage?.input_tokens && response.usage?.output_tokens
          ? response.usage.input_tokens + response.usage.output_tokens
          : undefined;

      // Cache the response
      if (cacheKey && content) {
        const ttl = parseInt(process.env.LLM_CACHE_TTL || '3600', 10);
        this.cache.set(cacheKey, content, ttl);
      }

      return {
        content,
        tokensUsed,
        cached: false,
      };
    } catch (error: any) {
      if (error.status === 429) {
        // Rate limit - wait and retry once
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return this.chat(messages);
      }
      throw new Error(`Anthropic API error: ${error.message}`);
    }
  }
}

class LocalLLMService implements LLMService {
  private config: LLMConfig;
  private cache: NodeCache;
  private cacheEnabled: boolean;

  constructor(config: LLMConfig, cache: NodeCache, cacheEnabled: boolean) {
    this.config = config;
    this.cache = cache;
    this.cacheEnabled = cacheEnabled;
  }

  isAvailable(): boolean {
    return !!this.config.baseURL;
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.config.baseURL) {
      throw new Error(
        'Local LLM base URL not configured. Check LLM_BASE_URL environment variable.'
      );
    }

    // Generate cache key
    const cacheKey = this.cacheEnabled
      ? `local:${this.config.model}:${JSON.stringify(messages)}`
      : null;

    // Check cache
    if (cacheKey && this.cache.has(cacheKey)) {
      const cached = this.cache.get<string>(cacheKey);
      if (cached) {
        return {
          content: cached,
          cached: true,
        };
      }
    }

    try {
      // Use OpenAI-compatible API format for local models
      // LLM_BASE_URL already includes the path prefix (e.g. http://localhost:1234/v1)
      const chatURL = `${this.config.baseURL}/chat/completions`;
      const response = await fetch(
        chatURL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && {
              Authorization: `Bearer ${this.config.apiKey}`,
            }),
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            max_tokens: this.config.maxTokens || 2000,
            temperature: this.config.temperature || 0.7,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Local LLM API error: ${response.statusText}`);
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || '';
      
      // Strip <think>...</think> blocks from reasoning models
      content = content.replace(/<think>[\s\S]*?<\/think>\n*/g, '').trim();
      
      const tokensUsed = data.usage?.total_tokens;

      // Cache the response
      if (cacheKey && content) {
        const ttl = parseInt(process.env.LLM_CACHE_TTL || '3600', 10);
        this.cache.set(cacheKey, content, ttl);
      }

      return {
        content,
        tokensUsed,
        cached: false,
      };
    } catch (error: any) {
      throw new Error(`Local LLM error: ${error.message}`);
    }
  }
}

// Singleton instance
let llmServiceInstance: LLMService | null = null;
let cacheInstance: NodeCache | null = null;

function getCache(): NodeCache {
  if (!cacheInstance) {
    cacheInstance = new NodeCache({
      stdTTL: parseInt(process.env.LLM_CACHE_TTL || '3600', 10),
      checkperiod: 600,
    });
  }
  return cacheInstance;
}

export function getLLMService(): LLMService {
  if (llmServiceInstance) {
    return llmServiceInstance;
  }

  const provider = (process.env.LLM_PROVIDER || 'openai') as
    | 'openai'
    | 'anthropic'
    | 'local';
  const model = process.env.LLM_MODEL || 'gpt-4-turbo-preview';
  const cacheEnabled = process.env.LLM_CACHE_ENABLED !== 'false';
  const cache = getCache();

  const config: LLMConfig = {
    provider,
    model,
    apiKey:
      provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : provider === 'anthropic'
        ? process.env.ANTHROPIC_API_KEY
        : process.env.LLM_API_KEY,
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '2000', 10),
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
    baseURL: process.env.LLM_BASE_URL,
    apiVersion: process.env.LLM_API_VERSION,
  };

  switch (provider) {
    case 'openai':
      llmServiceInstance = new OpenAILLMService(config, cache, cacheEnabled);
      break;
    case 'anthropic':
      llmServiceInstance = new AnthropicLLMService(config, cache, cacheEnabled);
      break;
    case 'local':
      llmServiceInstance = new LocalLLMService(config, cache, cacheEnabled);
      break;
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }

  return llmServiceInstance;
}

// Reset function for testing
export function resetLLMService(): void {
  llmServiceInstance = null;
  cacheInstance = null;
}
