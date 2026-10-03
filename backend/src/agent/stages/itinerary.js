import { z } from 'zod';

import { ItineraryDaySchema } from '../../schemas/recommendation.schema.js';
import { describePreferences, renderConstraints } from '../constraints.js';
import { SAFETY_PROMPT } from '../safety.js';
import { computeBudget } from '../itinerary/budgetMath.js';

/**
 * STAGE 5 — Itinerary generation (Nupur's reshape).
 *
 * The LLM proposes day structure, activities, descriptions, and a flexibility TIER per
 * activity ('required' | 'recommended' | 'optional'). It does NOT compute budget totals.
 * After the LLM returns, deterministic code (`computeBudget`) does the budget math, trims
 * optional items to fit, and emits a validation object + budget summary.
 *
 * @param {Function} llm
 * @param {object} destination - the chosen destination
 * @param {import('../../schemas/preferences.schema.js').NormalizedPreferences} prefs
 * @returns {Promise<{ title, summary, itinerary, validation, budgetSummary }>}
 */
const ItinerarySchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  itinerary: z.array(ItineraryDaySchema).min(1),
});

export async function generateItinerary(llm, destination, prefs) {
  const system = [
    'You are the itinerary-generation stage of a travel-planning agent.',
    `Build a realistic ${prefs.tripLengthDays}-day plan for the chosen destination.`,
    'Group nearby activities on the same day to minimize travel. Fill travelFromPreviousMin',
    'with a realistic minutes estimate between consecutive activities.',
    'Tag EACH activity with a "tier": "required" (arrival/check-in, departure/check-out,',
    'or anything essential), "recommended", or "optional". Do NOT compute budget totals;',
    'the server computes budget deterministically.',
    '',
    SAFETY_PROMPT,
    '',
    'Hard rules:',
    renderConstraints(),
  ].join('\n');

  const user = [
    'User preferences:',
    describePreferences(prefs),
    '',
    'Chosen destination:',
    JSON.stringify(destination, null, 2),
    '',
    `Produce EXACTLY ${prefs.tripLengthDays} itinerary days. Return JSON:`,
    '{ "title", "summary", "itinerary": [{ day, title, summary, activities: [{ time,',
    'title, description, travelFromPreviousMin, estimatedCostUsd, tier }] }] }.',
  ].join('\n');

  const draft = await llm(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    ItinerarySchema,
  );

  // Deterministic budget math + trimming + validation (NOT the LLM).
  const { itinerary, budgetSummary, validation } = computeBudget(draft.itinerary, prefs);

  return {
    title: draft.title,
    summary: draft.summary,
    itinerary,
    budgetSummary,
    validation,
  };
}
