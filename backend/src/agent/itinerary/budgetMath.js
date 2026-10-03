/**
 * Nupur's deterministic itinerary budget math (per itinerary-builder.md).
 *
 * The LLM proposes activities, descriptions, and flexibility tiers; it does NOT compute
 * budget totals. All budget arithmetic is done here, in pure code. If the plan exceeds
 * budget we trim OPTIONAL items cheapest-impact-first and never touch REQUIRED items.
 * If it still exceeds after exhausting optionals, the plan is returned over-budget with
 * an explicit note — never silently exceeded.
 */

const TIERS = ['required', 'recommended', 'optional'];

/** Normalize an activity's tier to a known value, defaulting to 'recommended'. */
export function normalizeTier(tier) {
  return TIERS.includes(tier) ? tier : 'recommended';
}

/**
 * Compute a budget summary and (if needed) trim optional activities to fit budget.
 *
 * @param {object[]} itinerary - days: [{ day, title, summary, activities: [{...}] }]
 * @param {import('../../schemas/preferences.schema.js').NormalizedPreferences} prefs
 * @returns {{ itinerary: object[], budgetSummary: object, validation: object }}
 */
export function computeBudget(itinerary, prefs) {
  // Work on a deep copy so the input is not mutated.
  const days = structuredClone(itinerary);

  // Ensure every activity has a normalized tier.
  for (const day of days) {
    for (const a of day.activities) {
      a.tier = normalizeTier(a.tier);
      a.estimatedCostUsd = Number(a.estimatedCostUsd) || 0;
    }
  }

  const budget = prefs.budgetUsd;
  let activities = sumActivities(days);

  const violations = [];
  const warnings = [];

  // Trim OPTIONAL activities (most expensive first) until within budget or exhausted.
  if (activities > budget) {
    const optionalRefs = [];
    for (const day of days) {
      for (const a of day.activities) {
        if (a.tier === 'optional') optionalRefs.push(a);
      }
    }
    optionalRefs.sort((x, y) => y.estimatedCostUsd - x.estimatedCostUsd);

    for (const a of optionalRefs) {
      if (activities <= budget) break;
      activities -= a.estimatedCostUsd;
      a.estimatedCostUsd = 0;
      a.trimmed = true;
      a.description = `${a.description} (trimmed to fit budget)`.trim();
    }
    // Drop activities we zeroed out, but keep at least one activity per day.
    for (const day of days) {
      const kept = day.activities.filter((a) => !a.trimmed);
      day.activities = kept.length > 0 ? kept : [day.activities[0]];
    }
    activities = sumActivities(days);
  }

  const foodEstimate = round2(prefs.dailyBudgetUsd * 0.3 * prefs.tripLengthDays);
  const transportation = round2(prefs.dailyBudgetUsd * 0.15 * prefs.tripLengthDays);
  const accommodation = round2(prefs.dailyBudgetUsd * 0.35 * prefs.tripLengthDays);
  const total = round2(activities + foodEstimate + transportation + accommodation);
  const remaining = round2(budget - total);

  const withinBudget = total <= budget;
  if (!withinBudget) {
    violations.push(
      `Estimated total $${total} exceeds your $${budget} budget even after trimming optional activities.`,
    );
  }

  // Required items present check (arrival/departure days should exist).
  const hasRequired = days.some((d) => d.activities.some((a) => a.tier === 'required'));
  if (!hasRequired) {
    warnings.push('No activity was marked required (e.g. arrival/departure).');
  }

  const budgetSummary = {
    accommodation,
    activities: round2(activities),
    transportation,
    foodEstimate,
    total,
    budget,
    remaining,
  };

  const validation = {
    valid: violations.length === 0,
    violations,
    warnings,
  };

  return { itinerary: days, budgetSummary, validation };
}

function sumActivities(days) {
  return round2(
    days.reduce(
      (sum, day) => sum + day.activities.reduce((d, a) => d + (Number(a.estimatedCostUsd) || 0), 0),
      0,
    ),
  );
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
