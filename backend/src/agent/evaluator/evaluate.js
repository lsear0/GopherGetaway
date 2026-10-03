import { config } from '../../config/env.js';

/**
 * Nupur's deterministic destination evaluator (per accommodation-evaluator.md).
 *
 * This is PURE CODE, not an LLM call. It:
 *   1. Runs hard-constraint checks FIRST (budget ceiling, max travel distance). A
 *      hard-constraint violation marks an item ineligible and is NEVER offset by a
 *      high preference score — scoring only runs on eligible items.
 *   2. Computes a transparent, config-driven score (weights from config, not inline).
 *   3. Records preference matches with honest 'unknown' handling.
 *   4. Emits a structured search-revision signal when nothing is eligible — it never
 *      silently relaxes a hard constraint.
 *
 * The score is explicitly NOT a safety or objective-quality rating.
 *
 * @param {object[]} candidates - budget-filtered destinations (RawCandidate-ish)
 * @param {import('../../schemas/preferences.schema.js').NormalizedPreferences} prefs
 * @returns {{
 *   chosen: object | null,
 *   ranked: object[],
 *   ineligible: object[],
 *   searchRevisionNeeded: boolean,
 *   searchRevisionReason: string | null
 * }}
 */
export function evaluateCandidates(candidates, prefs) {
  const weights = config.scoring.weights;
  const budgetCeiling = prefs.budgetUsd;
  const maxDistance = prefs.maxTravelDistanceKm ?? Infinity;

  const evaluated = candidates.map((candidate) =>
    evaluateOne(candidate, prefs, { budgetCeiling, maxDistance, weights }),
  );

  const eligible = evaluated.filter((c) => c.eligible);
  const ineligible = evaluated.filter((c) => !c.eligible);

  // Rank eligible items by the transparent score, highest first.
  eligible.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (eligible.length === 0) {
    return {
      chosen: null,
      ranked: [],
      ineligible,
      searchRevisionNeeded: true,
      searchRevisionReason: buildRevisionReason(ineligible),
    };
  }

  return {
    chosen: eligible[0],
    ranked: eligible,
    ineligible,
    searchRevisionNeeded: false,
    searchRevisionReason: null,
  };
}

function evaluateOne(candidate, prefs, { budgetCeiling, maxDistance, weights }) {
  const hardConstraintViolations = [];
  const unknownFields = [];
  const concerns = [];

  const cost = numberOrNull(candidate.estimatedTotalCostUsd);
  const distance = numberOrNull(candidate.distanceKm);

  // --- Hard constraints (checked BEFORE any scoring) ---
  if (cost == null) {
    unknownFields.push('estimatedTotalCostUsd');
  } else if (cost > budgetCeiling) {
    hardConstraintViolations.push('exceeds_max_budget');
  }

  if (distance == null) {
    unknownFields.push('distanceKm');
  } else if (distance > maxDistance) {
    hardConstraintViolations.push('exceeds_max_travel_distance');
  }

  const matchedInterests = Array.isArray(candidate.matchedInterests)
    ? candidate.matchedInterests
    : [];

  const eligible = hardConstraintViolations.length === 0;

  // Honest unknowns feed into preference matches rather than silently passing.
  const preferenceMatches = {
    withinBudget: cost == null ? 'unknown' : cost <= budgetCeiling,
    withinDistance:
      distance == null ? 'unknown' : distance === Infinity ? 'unknown' : distance <= maxDistance,
    interestMatch: matchedInterests.length > 0,
  };

  if (preferenceMatches.withinDistance === 'unknown') {
    concerns.push('Travel distance could not be evaluated with the available data.');
  }

  // Scoring ONLY runs on eligible items (hard violations are never offset by score).
  let score = null;
  if (eligible) {
    const budgetFitScore = cost == null ? 0.5 : clamp01(1 - cost / Math.max(budgetCeiling, 1));
    const distanceFitScore =
      distance == null || maxDistance === Infinity
        ? 0.5
        : clamp01(1 - distance / Math.max(maxDistance, 1));
    const interestMatchScore = clamp01(
      matchedInterests.length / Math.max(prefs.interests.length, 1),
    );
    // locationFit / transportationFit: without routing data we score these as neutral
    // (0.5) and keep them honest via unknownFields rather than inventing a value.
    const locationFitScore = 0.5;
    const transportationFitScore = 0.5;
    unknownFields.push('transportationFit');

    score = round4(
      weights.budgetFit * budgetFitScore +
        weights.preferenceMatch * interestMatchScore +
        weights.locationFit * locationFitScore +
        weights.transportationFit * transportationFitScore +
        weights.interestMatch * interestMatchScore,
    );
  }

  return {
    // Preserve all original destination fields (name, country, whyItFits, etc.).
    ...candidate,
    eligible,
    hardConstraintViolations,
    preferenceMatches,
    score,
    concerns,
    unknownFields: dedupe(unknownFields),
    source: candidate.source ?? { provider: candidate.provider ?? 'unknown' },
  };
}

function buildRevisionReason(ineligible) {
  const overBudget = ineligible.some((c) =>
    c.hardConstraintViolations.includes('exceeds_max_budget'),
  );
  const tooFar = ineligible.some((c) =>
    c.hardConstraintViolations.includes('exceeds_max_travel_distance'),
  );
  if (overBudget && tooFar) {
    return 'No destinations fit within both your budget and distance limits.';
  }
  if (overBudget) return 'No destinations satisfy the maximum budget.';
  if (tooFar) return 'No destinations fall within the maximum travel distance.';
  return 'No eligible destinations remained after the hard-constraint checks.';
}

function numberOrNull(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function dedupe(arr) {
  return [...new Set(arr)];
}
