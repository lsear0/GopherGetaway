/**
 * STAGE 6 — Budget validation.
 *
 * The final, authoritative budget check. It recomputes the itinerary's estimated total
 * from the actual activity costs (never trusting a single number the model asserted),
 * builds a structured breakdown, and sets `withinBudget` based on a server-side
 * comparison against the user's limit.
 *
 * @param {import('../../schemas/recommendation.schema.js').TripRecommendation} recommendation
 * @param {import('../../schemas/preferences.schema.js').NormalizedPreferences} prefs
 * @returns {import('../../schemas/recommendation.schema.js').TripRecommendation}
 */
export function validateBudget(recommendation, prefs) {
  // Sum activity costs across every day — the ground truth for the estimate.
  const activitiesTotal = recommendation.itinerary.reduce(
    (sum, day) => sum + day.activities.reduce((d, a) => d + (a.estimatedCostUsd || 0), 0),
    0,
  );

  // Preserve any non-activity line items the provider supplied (flights, lodging),
  // but recompute the overall total from the breakdown + activities so the number is ours.
  const providerBreakdown = recommendation.budget?.breakdown ?? [];
  const nonActivityItems = providerBreakdown.filter(
    (item) => !/activities/i.test(item.label),
  );
  const nonActivityTotal = nonActivityItems.reduce((s, i) => s + i.amountUsd, 0);

  const estimatedTotalUsd = round2(activitiesTotal + nonActivityTotal);

  const breakdown = [
    ...nonActivityItems,
    { label: 'Activities', amountUsd: round2(activitiesTotal), confidence: 'estimate' },
  ];

  return {
    ...recommendation,
    budget: {
      currency: 'USD',
      limitUsd: prefs.budgetUsd,
      estimatedTotalUsd,
      withinBudget: estimatedTotalUsd <= prefs.budgetUsd,
      breakdown,
    },
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
