/**
 * STAGE 3 — Budget filtering.
 *
 * Discovery can propose destinations that are simply unaffordable. This stage drops any
 * candidate whose estimated total cost exceeds the user's (server-trusted) budget, and
 * also drops anything beyond an optional max travel distance. Pure logic — no LLM — so
 * the budget ceiling is enforced by code, not by asking the model nicely.
 *
 * A small tolerance is allowed because discovery costs are rough; the budget-validation
 * stage later does the strict check on the final itinerary.
 *
 * @param {object[]} destinations - candidates from discovery
 * @param {import('../../schemas/preferences.schema.js').NormalizedPreferences} prefs
 * @returns {{ kept: object[], rejected: object[] }}
 */
export function filterByBudget(destinations, prefs) {
  const ceiling = prefs.budgetUsd * 1.1; // 10% tolerance at the discovery stage
  const maxDistance = prefs.maxTravelDistanceKm ?? Infinity;

  const kept = [];
  const rejected = [];

  for (const dest of destinations) {
    const tooExpensive = dest.estimatedTotalCostUsd > ceiling;
    const tooFar = dest.distanceKm > maxDistance;
    if (tooExpensive || tooFar) {
      rejected.push({
        ...dest,
        rejectedReason: tooExpensive ? 'over_budget' : 'too_far',
      });
    } else {
      kept.push(dest);
    }
  }

  // Keep the cheapest-first ordering so evaluation sees affordable options first.
  kept.sort((a, b) => a.estimatedTotalCostUsd - b.estimatedTotalCostUsd);
  return { kept, rejected };
}
