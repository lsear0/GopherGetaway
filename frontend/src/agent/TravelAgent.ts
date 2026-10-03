import type { TripPreferences } from '../planner/types';
import type { TripModifier, TripRecommendation } from './recommendationTypes';

/**
 * The TravelAgent abstraction — the single seam between the UI and however a trip gets
 * generated.
 *
 * Today the only implementation is the deterministic MockTravelAgent. To go live with a
 * real model, implement this same interface backed by the server's
 * /api/recommendations pipeline (so the API key stays on the server) and swap it in via
 * the factory in ./index.ts. No results-page component changes, because they depend only
 * on this interface and the recommendation types.
 */
export interface TravelAgent {
  /** Produce a fresh recommendation from the student's questionnaire answers. */
  generateTrip(prefs: TripPreferences): Promise<TripRecommendation>;

  /**
   * Produce a revised recommendation given a modifier (cheaper, more adventurous, …).
   * Implementations receive the preferences and the current recommendation so they can
   * adjust intelligently; the mock derives a new seed, a real agent could re-prompt with
   * the prior plan as context.
   */
  applyModifier(
    prefs: TripPreferences,
    current: TripRecommendation,
    modifier: TripModifier,
  ): Promise<TripRecommendation>;
}
