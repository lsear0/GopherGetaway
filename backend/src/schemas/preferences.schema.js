import { z } from 'zod';

/**
 * Server-side validation schemas for incoming user preferences.
 *
 * SECURITY: this is the trust boundary. Everything the client sends is treated as
 * hostile until it passes through here. Budget, duration, and every other value are
 * validated and clamped on the server — the client's claims are never taken at face
 * value by downstream pipeline stages.
 */

export const TRAVEL_PACE = ['relaxed', 'balanced', 'packed'];
export const TRIP_STYLES = ['budget', 'moderate', 'comfort'];

/**
 * Raw request body shape accepted by POST /api/recommendations.
 * Unknown keys are stripped (not errored on) so the frontend can evolve independently.
 */
export const PreferencesInputSchema = z
  .object({
    // Hard budget ceiling in USD. Required and bounded so the agent can't be told to
    // "plan a $0 trip" or an absurd number that produces nonsense.
    budgetUsd: z
      .number({ invalid_type_error: 'Budget must be a number.' })
      .finite()
      .min(50, 'Budget must be at least $50.')
      .max(100000, 'Budget must be at most $100,000.'),

    tripLengthDays: z
      .number({ invalid_type_error: 'Trip length must be a number.' })
      .int('Trip length must be a whole number of days.')
      .min(1, 'Trip must be at least 1 day.')
      .max(30, 'Trip must be at most 30 days.'),

    interests: z
      .array(z.string().trim().min(1).max(60))
      .max(20, 'Please list at most 20 interests.')
      .default([]),

    departureCity: z.string().trim().min(1).max(120).default('Minneapolis'),

    // Optional soft hints.
    maxTravelDistanceKm: z
      .number()
      .positive()
      .max(20000)
      .optional(),

    travelPace: z.enum(TRAVEL_PACE).default('balanced'),
    tripStyle: z.enum(TRIP_STYLES).default('moderate'),

    // Free-text notes. Length-capped to limit prompt-injection surface and token cost.
    notes: z.string().trim().max(1000).default(''),
  })
  .strip();

/**
 * Normalized preferences — the clean, canonical object every pipeline stage and
 * provider consumes. Produced by the normalization stage from validated input.
 */
export const NormalizedPreferencesSchema = PreferencesInputSchema.extend({
  // De-duplicated, lower-cased interests with a guaranteed non-empty fallback.
  interests: z.array(z.string()).min(1),
  // Per-day budget derived server-side; never supplied by the client.
  dailyBudgetUsd: z.number().positive(),
});

/** @typedef {z.infer<typeof PreferencesInputSchema>} PreferencesInput */
/** @typedef {z.infer<typeof NormalizedPreferencesSchema>} NormalizedPreferences */
