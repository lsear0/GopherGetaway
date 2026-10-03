import dotenv from 'dotenv';

dotenv.config();

/**
 * Centralized, validated environment configuration.
 * Importing from here (instead of reading process.env everywhere) keeps config
 * in one place and makes it easy to see what the app depends on.
 */
export const config = {
  port: Number(process.env.PORT) || 3001,
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
};

/** Whether a real OpenAI key is configured. When false, the service uses mock data. */
export const hasOpenAIKey = Boolean(config.openai.apiKey);
