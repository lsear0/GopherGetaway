import { TravelAgentProvider } from './TravelAgentProvider.js';
import { runPipeline } from '../agent/pipeline.js';

/**
 * MockTravelAgentProvider — runs the real multi-stage pipeline, but its injected `llm`
 * step returns deterministic, schema-valid data derived from the preferences instead of
 * calling a model. This lets the full agent architecture (and the frontend) be exercised
 * end-to-end with no API key, and makes tests reproducible.
 *
 * The mock inspects the system prompt to detect which stage is asking, then returns an
 * appropriately-shaped object. It stays within the stated budget by construction.
 */
export class MockTravelAgentProvider extends TravelAgentProvider {
  name = 'mock';

  async generateTripStream(preferences, onStage) {
    const llm = makeMockLlm(preferences);
    return runPipeline({
      input: preferences,
      llm,
      meta: { provider: this.name },
      onStage,
    });
  }
}

/**
 * Build a deterministic llm(messages, schema) function closed over the request so the
 * fabricated data respects the user's budget, duration, and interests.
 */
function makeMockLlm(prefs) {
  const budget = prefs.budgetUsd;
  const days = prefs.tripLengthDays;
  const interests = prefs.interests;
  const city = prefs.departureCity;

  // Small, deterministic candidate set seeded from the departure city + interests.
  const sampleDestinations = [
    { name: 'Duluth', country: 'USA', distanceKm: 250 },
    { name: 'Chicago', country: 'USA', distanceKm: 650 },
    { name: 'Denver', country: 'USA', distanceKm: 1300 },
    { name: 'Toronto', country: 'Canada', distanceKm: 1400 },
  ].map((d, i) => ({
    ...d,
    // Cost scales toward (but under) the budget so some pass the filter.
    estimatedTotalCostUsd: Math.round(budget * (0.6 + i * 0.12)),
    whyItFits: `Good match for ${interests.slice(0, 2).join(' and ')} within reach of ${city}.`,
    matchedInterests: interests.slice(0, 2),
  }));

  return async (messages, schema) => {
    const system = messages.find((m) => m.role === 'system')?.content ?? '';

    if (/destination-discovery/.test(system)) {
      return schema.parse({ destinations: sampleDestinations });
    }

    if (/destination-evaluation/.test(system)) {
      // Pick the cheapest candidate the filter kept (passed in the user message JSON).
      const kept = extractCandidates(messages);
      const chosen = kept[0];
      return schema.parse({ chosen, ranked: kept });
    }

    if (/itinerary-generation/.test(system)) {
      const perDay = Math.max(1, Math.round((budget / days) * 0.9));
      const itinerary = Array.from({ length: days }, (_, i) => ({
        day: i + 1,
        title: `Day ${i + 1}: ${capitalize(interests[i % interests.length])}`,
        summary: `A ${prefs.travelPace} day focused on ${interests[i % interests.length]}.`,
        activities: [
          {
            time: '09:00',
            title: `Morning: ${capitalize(interests[i % interests.length])}`,
            description: 'Sample activity (mock provider — set OPENAI_API_KEY for real plans).',
            travelFromPreviousMin: 0,
            estimatedCostUsd: Math.round(perDay * 0.4),
          },
          {
            time: '14:00',
            title: `Afternoon: ${capitalize(interests[(i + 1) % interests.length])}`,
            description: 'Sample activity grouped nearby to limit travel time.',
            travelFromPreviousMin: 20,
            estimatedCostUsd: Math.round(perDay * 0.6),
          },
        ],
      }));
      return schema.parse({
        title: `${days}-day ${prefs.tripStyle} trip from ${city}`,
        summary: `A sample ${days}-day itinerary built by the mock travel agent.`,
        itinerary,
      });
    }

    throw new Error('MockTravelAgentProvider: unrecognized stage prompt');
  };
}

/** Pull the candidate-destination JSON back out of the evaluation user message. */
function extractCandidates(messages) {
  const user = messages.find((m) => m.role === 'user')?.content ?? '';
  const match = user.match(/\[\s*{[\s\S]*}\s*\]/);
  if (!match) return [];
  try {
    return JSON.parse(match[0]);
  } catch {
    return [];
  }
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
