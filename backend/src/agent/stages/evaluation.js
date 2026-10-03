import { evaluateCandidates } from '../evaluator/evaluate.js';

/**
 * STAGE 4 — Destination evaluation (Nupur's deterministic rewrite).
 *
 * This stage is now DETERMINISTIC CODE, not an LLM ranking call. Eligibility
 * (hard-constraint checks) and the transparent, config-driven score are computed by
 * `evaluateCandidates` (src/agent/evaluator/evaluate.js). The LLM's only role here is to
 * interpret results into human-readable reasons — it never decides eligibility or scores.
 *
 * Signature is kept as (llm, candidates, prefs) so the pipeline and both providers are
 * unchanged; `llm` is optional and used only for the prose reasons.
 *
 * @param {Function} llm - async (messages, zodSchema) => parsed; used only for prose.
 * @param {object[]} candidates - budget-filtered destinations
 * @param {import('../../schemas/preferences.schema.js').NormalizedPreferences} prefs
 * @returns {Promise<{ chosen: object, ranked: object[], ineligible: object[],
 *   searchRevisionNeeded: boolean, searchRevisionReason: string | null }>}
 */
export async function evaluateDestinations(llm, candidates, prefs) {
  const result = evaluateCandidates(candidates, prefs);

  if (result.searchRevisionNeeded || !result.chosen) {
    // Signal the orchestrator; it enforces the max-search-revision cap.
    return result;
  }

  // Attach deterministic recommendation reasons (template-based, provider-agnostic).
  // We keep this deterministic so the mock and real providers behave identically and no
  // unsupported safety claims are introduced.
  const withReasons = result.ranked.map((c) => ({
    ...c,
    recommendationReasons: buildReasons(c, prefs),
  }));

  return {
    ...result,
    chosen: withReasons[0],
    ranked: withReasons,
  };
}

function buildReasons(candidate, prefs) {
  const reasons = [];
  if (candidate.preferenceMatches?.withinBudget === true) {
    reasons.push(
      `Estimated total of ~$${Math.round(candidate.estimatedTotalCostUsd)} fits within your $${prefs.budgetUsd} budget.`,
    );
  }
  if (Array.isArray(candidate.matchedInterests) && candidate.matchedInterests.length > 0) {
    reasons.push(`Matches your interests: ${candidate.matchedInterests.join(', ')}.`);
  }
  if (candidate.whyItFits) reasons.push(candidate.whyItFits);
  if (reasons.length === 0) reasons.push('Eligible under all of your hard constraints.');
  return reasons.slice(0, 3);
}
