import { resolveProviderName } from '../config/env.js';
import { MockTravelAgentProvider } from './MockTravelAgentProvider.js';
import { OpenAITravelAgentProvider } from './OpenAITravelAgentProvider.js';
import { OpenAIMcpTravelAgentProvider } from './OpenAIMcpTravelAgentProvider.js';

/**
 * Provider factory — the ONE place that decides which TravelAgentProvider is in use.
 * Everything upstream (controller, routes, frontend) depends only on the abstract
 * contract, so swapping providers — or adding a new one (Anthropic, local model, ...) —
 * means editing only this file.
 */
let cached = null;

export function getTravelAgentProvider() {
  if (cached) return cached;

  const name = resolveProviderName(); // 'mock' | 'openai' | 'openai+mcp'
  switch (name) {
    case 'openai+mcp':
      cached = new OpenAIMcpTravelAgentProvider();
      break;
    case 'openai':
      cached = new OpenAITravelAgentProvider();
      break;
    case 'mock':
    default:
      cached = new MockTravelAgentProvider();
      break;
  }
  return cached;
}

/** Testing/HMR helper: drop the cached provider so the next call rebuilds it. */
export function resetTravelAgentProvider() {
  cached = null;
}
