import { z } from 'zod';

import { describePreferences, renderConstraints } from '../constraints.js';

/**
 * STAGE 2 — Destination discovery.
 *
 * Asks the LLM to brainstorm a shortlist of candidate destinations that match the
 * user's interests and departure city, each with a rough cost and distance. This stage
 * is deliberately generous: budget filtering (stage 3) prunes it afterward.
 *
 * The `llm` argument is a provider-supplied function: (messages, schema) => parsedObject.
 * Injecting it keeps this stage identical for the mock and real providers.
 *
 * @param {Function} llm - async (messages, zodSchema) => parsed JSON matching the schema
 * @param {import('../../schemas/preferences.schema.js').NormalizedPreferences} prefs
 * @returns {Promise<object[]>} candidate destinations
 */
const DiscoverySchema = z.object({
  destinations: z
    .array(
      z.object({
        name: z.string(),
        country: z.string().default(''),
        distanceKm: z.number().min(0),
        estimatedTotalCostUsd: z.number().min(0),
        whyItFits: z.string(),
        matchedInterests: z.array(z.string()).default([]),
      }),
    )
    .min(1),
});

export async function discoverDestinations(llm, prefs) {
  const system = [
    'You are the destination-discovery stage of a travel-planning agent.',
    'Propose 4-6 candidate destinations reachable from the departure city that match the',
    'user\'s interests. Give a rough per-destination total cost estimate and great-circle',
    'distance in km. Be realistic, not aspirational.',
    '',
    'Hard rules:',
    renderConstraints(),
  ].join('\n');

  const user = [
    'User preferences:',
    describePreferences(prefs),
    '',
    'Return a JSON object: { "destinations": [{ name, country, distanceKm,',
    'estimatedTotalCostUsd, whyItFits, matchedInterests }] }.',
  ].join('\n');

  const result = await llm(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    DiscoverySchema,
  );

  return result.destinations;
}
