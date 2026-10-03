/**
 * The hard rules the travel agent must obey, expressed once and reused across every
 * LLM-driven stage. Centralizing them keeps the agent's behavior consistent and makes
 * the product requirements auditable in one place.
 */
export const AGENT_CONSTRAINTS = [
  'Stay within the user\'s stated budget. Never propose a plan whose estimated total exceeds the budget.',
  'Respect the exact trip duration in days. One itinerary day per trip day, no more, no less.',
  'Consider travel distance from the departure city; prefer closer destinations when they fit the interests.',
  'Prioritize the user\'s stated interests above generic tourist activities.',
  'Avoid impossible itineraries (e.g. two cities a continent apart on the same day).',
  'Do not schedule activities that are unrealistically far apart within a single day.',
  'Include realistic travel time between activities (in minutes) in travelFromPreviousMin.',
  'Explain clearly why each destination fits the user (whyItFits).',
  'Provide estimated costs for activities and the overall trip.',
  'All prices are ESTIMATES, not confirmed bookings. Mark cost confidence as "estimate".',
];

/** Render the constraints as a numbered block for a system prompt. */
export function renderConstraints() {
  return AGENT_CONSTRAINTS.map((c, i) => `${i + 1}. ${c}`).join('\n');
}

/** A compact description of the user, reused in several stage prompts. */
export function describePreferences(prefs) {
  return [
    `Departure city: ${prefs.departureCity}`,
    `Total budget: $${prefs.budgetUsd} USD (about $${prefs.dailyBudgetUsd}/day)`,
    `Trip length: ${prefs.tripLengthDays} days`,
    `Interests: ${prefs.interests.join(', ')}`,
    `Travel pace: ${prefs.travelPace}`,
    `Trip style: ${prefs.tripStyle}`,
    prefs.maxTravelDistanceKm ? `Max travel distance: ${prefs.maxTravelDistanceKm} km` : null,
    prefs.notes ? `Notes: ${prefs.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
