import OpenAI from 'openai';

import { config, hasOpenAIKey } from '../config/env.js';
import { httpError } from '../middleware/errorHandler.js';

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

/**
 * Centralized chat-completion wrapper used by the MCP tool-calling loop (Bear's helper).
 * Keeps request formatting in one place and maps SDK errors to a 502 httpError.
 */
export async function createChatCompletion({ messages, tools = [], toolChoice, responseFormat }) {
  const openai = getOpenAIClient();

  if (!openai) {
    throw httpError(500, 'OpenAI is not configured for live trip generation.');
  }

  try {
    return await openai.chat.completions.create({
      model: config.openai.model,
      messages,
      ...(responseFormat ? { response_format: responseFormat } : {}),
      ...(tools.length ? { tools, tool_choice: toolChoice || 'auto' } : {}),
    });
  } catch (error) {
    throw httpError(502, 'OpenAI failed while generating the travel plan.', {
      status: error.status,
      message: error.message,
      code: error.code,
    });
  }
}
