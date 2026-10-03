import dotenv from 'dotenv';

dotenv.config();

/**
 * Centralized, validated environment configuration.
 * Importing from here (instead of reading process.env everywhere) keeps config
 * in one place and makes it easy to see what the app depends on.
 */
export const config = {
  port: Number(process.env.PORT) || 3001,

  // Which TravelAgentProvider to use: 'auto' | 'mock' | 'openai'.
  // 'auto' picks the real LLM provider when a key is present, otherwise mock.
  provider: (process.env.TRAVEL_AGENT_PROVIDER || 'auto').toLowerCase(),

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },

  // Rate limiting for the generation endpoint.
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
    max: Number(process.env.RATE_LIMIT_MAX) || 20, // requests per window per IP
  },
};

/** Whether a real OpenAI key is configured. When false, the service uses mock data. */
export const hasOpenAIKey = Boolean(config.openai.apiKey);

/**
 * Resolve the effective provider name given config + available credentials.
 * Never throws: falls back to 'mock' when a real provider is requested but no key exists.
 * @returns {'mock' | 'openai'}
 */
export function resolveProviderName() {
  if (config.provider === 'mock') return 'mock';
  if (config.provider === 'openai') return hasOpenAIKey ? 'openai' : 'mock';
  // 'auto' (default)
  return hasOpenAIKey ? 'openai' : 'mock';
}
