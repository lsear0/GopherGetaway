import { z } from 'zod';

import { ItineraryDaySchema } from '../../schemas/recommendation.schema.js';
import { describePreferences, renderConstraints } from '../constraints.js';

/**
 * STAGE 5 — Itinerary generation.
 *
 * Given the chosen destination, asks the LLM to build a day-by-day plan: exactly one
 * entry per trip day, interest-aligned activities, realistic per-activity travel times,
 * and per-activity cost estimates. This is where "avoid activities too far apart" and
 * "include realistic travel time" are enforced in the prompt and later checked by the
 * budget-validation stage.
 *
 * @param {Function} llm
 * @param {object} destination - the chosen destination
 * @param {import('../../schemas/preferences.schema.js').NormalizedPreferences} prefs
 * @returns {Promise<{ title: string, summary: string, itinerary: object[] }>}
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
    'with a realistic minutes estimate between consecutive activities. Keep the daily spend',
    `near the user's ~$${prefs.dailyBudgetUsd}/day target and the trip within budget.`,
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
    'title, description, travelFromPreviousMin, estimatedCostUsd }] }] }.',
  ].join('\n');

  return llm(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    ItinerarySchema,
  );
}
