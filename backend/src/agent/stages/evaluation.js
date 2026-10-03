import { z } from 'zod';

import { DestinationSchema } from '../../schemas/recommendation.schema.js';
import { describePreferences, renderConstraints } from '../constraints.js';

/**
 * STAGE 4 — Destination evaluation.
 *
 * Takes the budget-filtered shortlist and asks the LLM to score and rank them against
 * the user's interests, distance tolerance, and budget, then pick the single best fit.
 * Produces the winning destination plus the ranked runners-up (for transparency in the
 * UI — the user asked to see why destinations fit).
 *
 * @param {Function} llm
 * @param {object[]} candidates - budget-filtered destinations
 * @param {import('../../schemas/preferences.schema.js').NormalizedPreferences} prefs
 * @returns {Promise<{ chosen: object, ranked: object[] }>}
 */
const EvaluationSchema = z.object({
  chosen: DestinationSchema,
  ranked: z.array(DestinationSchema).min(1),
});

export async function evaluateDestinations(llm, candidates, prefs) {
  const system = [
    'You are the destination-evaluation stage of a travel-planning agent.',
    'Score each candidate on interest match, distance, and value for money. Pick the single',
    'best destination for this user and return the full ranked list with reasoning.',
    '',
    'Hard rules:',
    renderConstraints(),
  ].join('\n');

  const user = [
    'User preferences:',
    describePreferences(prefs),
    '',
    'Candidate destinations (already filtered to fit the budget):',
    JSON.stringify(candidates, null, 2),
    '',
    'Return JSON: { "chosen": <destination>, "ranked": [<destination>...] } where each',
    'destination has { name, country, distanceKm, whyItFits, estimatedTotalCostUsd,',
    'matchedInterests }. "chosen" must be the best fit and also appear first in "ranked".',
  ].join('\n');

  return llm(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    EvaluationSchema,
  );
}
