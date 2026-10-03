import { z } from 'zod';

/**
 * Output schemas for the travel agent.
 *
 * These define the TripRecommendation contract every provider (mock or real LLM) must
 * satisfy. The pipeline validates provider output against these schemas, so a model that
 * hallucinates an off-shape response is caught server-side instead of reaching the UI.
 */

/**
 * A single cost line item. `confidence` makes the estimate-vs-confirmed distinction
 * explicit and machine-readable so the UI can label prices honestly.
 */
export const CostItemSchema = z.object({
  label: z.string().min(1),
  amountUsd: z.number().min(0),
  // 'estimate'  -> model's best guess, show with an "est." qualifier
  // 'confirmed' -> a real, looked-up price (reserved for future price integrations)
  confidence: z.enum(['estimate', 'confirmed']).default('estimate'),
});

export const ActivitySchema = z.object({
  time: z.string().min(1), // e.g. "09:00" or "Morning"
  title: z.string().min(1),
  description: z.string().default(''),
  // Rough travel time to reach this activity from the previous one, in minutes.
  travelFromPreviousMin: z.number().min(0).default(0),
  estimatedCostUsd: z.number().min(0).default(0),
  // Nupur: flexibility tier. 'required' items are never trimmed by budget math.
  tier: z.enum(['required', 'recommended', 'optional']).default('recommended'),
  // Provenance when the activity came from a tool/provider; 'llm-estimate' otherwise.
  source: z
    .object({
      provider: z.string().optional(),
      url: z.string().optional(),
      toolName: z.string().optional(),
    })
    .optional(),
});

export const ItineraryDaySchema = z.object({
  day: z.number().int().min(1),
  title: z.string().min(1),
  summary: z.string().default(''),
  activities: z.array(ActivitySchema).min(1),
});

/**
 * A candidate destination the agent considered, with the reasoning the user asked for:
 * why it fits, its distance, and an estimated cost.
 */
/**
 * Nupur's deterministic evaluation result attached to each destination (additive).
 * The score is a ranking signal among ELIGIBLE options only — never a safety rating.
 */
export const EvaluationSchema = z.object({
  eligible: z.boolean(),
  hardConstraintViolations: z.array(z.string()).default([]),
  preferenceMatches: z.record(z.union([z.boolean(), z.literal('unknown')])).default({}),
  score: z.number().nullable().default(null),
  concerns: z.array(z.string()).default([]),
  unknownFields: z.array(z.string()).default([]),
  recommendationReasons: z.array(z.string()).default([]),
});

export const DestinationSchema = z.object({
  name: z.string().min(1),
  country: z.string().default(''),
  distanceKm: z.number().min(0),
  // Human-readable justification tying the destination to the user's interests/budget.
  whyItFits: z.string().min(1),
  estimatedTotalCostUsd: z.number().min(0),
  matchedInterests: z.array(z.string()).default([]),
  // Deterministic evaluator output (additive; present once evaluated).
  eligible: z.boolean().optional(),
  hardConstraintViolations: z.array(z.string()).optional(),
  preferenceMatches: z.record(z.union([z.boolean(), z.literal('unknown')])).optional(),
  score: z.number().nullable().optional(),
  concerns: z.array(z.string()).optional(),
  unknownFields: z.array(z.string()).optional(),
  recommendationReasons: z.array(z.string()).optional(),
  source: z
    .object({
      provider: z.string().optional(),
      url: z.string().optional(),
      toolName: z.string().optional(),
    })
    .optional(),
});

/**
 * The full recommendation returned to the client.
 */
export const TripRecommendationSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),

  // The destination the itinerary is built around, plus the runners-up the agent weighed.
  destination: DestinationSchema,
  consideredDestinations: z.array(DestinationSchema).default([]),
  // Destinations rejected by the deterministic evaluator's hard-constraint checks
  // (carried for UI transparency).
  ineligibleDestinations: z.array(DestinationSchema).default([]),

  itinerary: z.array(ItineraryDaySchema).min(1),

  // Nupur: itinerary validation object + deterministic budget summary (additive).
  validation: z
    .object({
      valid: z.boolean(),
      violations: z.array(z.string()).default([]),
      warnings: z.array(z.string()).default([]),
    })
    .optional(),
  budgetSummary: z
    .object({
      accommodation: z.number(),
      activities: z.number(),
      transportation: z.number(),
      foodEstimate: z.number(),
      total: z.number(),
      budget: z.number(),
      remaining: z.number(),
    })
    .optional(),
  // Uncertainty disclosures from the safety post-processor (additive).
  safetyNotes: z.array(z.string()).default([]),

  // Structured budget breakdown. `withinBudget` is set by the budget-validation stage,
  // not by the model, so it reflects a server-side check.
  budget: z.object({
    currency: z.literal('USD').default('USD'),
    limitUsd: z.number().min(0),
    estimatedTotalUsd: z.number().min(0),
    withinBudget: z.boolean(),
    breakdown: z.array(CostItemSchema).default([]),
  }),

  // Honesty note shown in the UI: these are estimates, not bookable prices.
  disclaimer: z
    .string()
    .default(
      'All prices are estimates generated by an AI assistant, not confirmed bookings. ' +
        'Verify costs and availability before booking.',
    ),

  // Provenance so callers can see which provider produced this (UI stays agnostic).
  meta: z
    .object({
      provider: z.string(),
      model: z.string().optional(),
      generatedAt: z.string(),
    })
    .optional(),
});

/** @typedef {z.infer<typeof TripRecommendationSchema>} TripRecommendation */
