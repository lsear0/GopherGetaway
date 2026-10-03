import OpenAI from 'openai';

import { config, hasOpenAIKey } from '../config/env.js';

/**
 * Lazily-created singleton OpenAI client. Returns null when no key is configured
 * so callers can fall back to mock data instead of crashing.
 */
let client = null;

export function getOpenAIClient() {
  if (!hasOpenAIKey) return null;
  if (!client) {
    client = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return client;
}
