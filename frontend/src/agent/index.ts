import type { TravelAgent } from './TravelAgent';
import { MockTravelAgent } from './mockTravelAgent';

/**
 * Factory for the active TravelAgent. This is the ONE place that decides which
 * implementation the app uses, so switching from the mock to a real LLM-backed agent
 * (one that calls the server's /api/recommendations pipeline) is a one-line change here.
 * No UI or hook code references a concrete implementation.
 */
let instance: TravelAgent | null = null;

export function getTravelAgent(): TravelAgent {
  if (!instance) {
    instance = new MockTravelAgent();
  }
  return instance;
}

export type { TravelAgent } from './TravelAgent';
export * from './recommendationTypes';
