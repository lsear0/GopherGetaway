import { TripRecommendationSchema } from '../schemas/recommendation.schema.js';
import { httpError } from '../middleware/errorHandler.js';
import { config } from '../config/env.js';

import { normalizePreferences } from './stages/normalize.js';
import { discoverDestinations } from './stages/discovery.js';
import { filterByBudget } from './stages/budgetFilter.js';
import { evaluateDestinations } from './stages/evaluation.js';
import { generateItinerary } from './stages/itinerary.js';
import { validateBudget } from './stages/budgetValidation.js';
import { applySafetyLanguage } from './safety.js';

/**
 * The structured travel-agent pipeline.
 *
 *   validated input
 *        ↓ normalize           (pure)
 *        ↓ discover            (LLM / MCP)
 *        ↓ budget filter       (pure)
 *        ↓ evaluate            (pure, deterministic — Nupur)
 *        ↓ itinerary           (LLM proposes; pure budget math — Nupur)
 *        ↓ budget validation   (pure, authoritative)
 *        → safety scrub (pure) → final response
 *
 * discover→filter→evaluate runs inside a bounded search-revision loop (Nupur's cap).
 * Both the mock and real providers call this exact function; they differ only in the
 * `llm` step they inject.
 *
 * @param {object} params
 * @param {import('../schemas/preferences.schema.js').PreferencesInput} params.input
 * @param {Function} params.llm - async (messages, zodSchema) => parsed object
 * @param {object} params.meta - { provider, model? } provenance stamped on the result
 * @param {(event: {stage: string, status: 'start'|'done', detail?: any}) => void} [params.onStage]
 * @returns {Promise<import('../schemas/recommendation.schema.js').TripRecommendation>}
 */
export async function runPipeline({ input, llm, meta, onStage = () => {} }) {
  const emit = (stage, status, detail) => onStage({ stage, status, detail });

  // 1. Normalize (pure, server-derived values).
  emit('normalize', 'start');
  const prefs = normalizePreferences(input);
  emit('normalize', 'done', { dailyBudgetUsd: prefs.dailyBudgetUsd });

  // --- Bounded search-revision loop (Nupur's max-iteration cap) ---
  const maxRevisions = config.agent.maxSearchRevisions;
  let evaluation = null;
  let lastRevisionReason = null;

  for (let revision = 0; revision < maxRevisions; revision += 1) {
    // 2. Discover candidate destinations (LLM / MCP).
    emit('discovery', 'start', { revision });
    const candidates = await discoverDestinations(llm, prefs);
    emit('discovery', 'done', { count: candidates.length });

    // 3. Budget filter (pure — enforces the ceiling in code).
    emit('budgetFilter', 'start');
    const { kept, rejected } = filterByBudget(candidates, prefs);
    emit('budgetFilter', 'done', { kept: kept.length, rejected: rejected.length });

    if (kept.length === 0) {
      lastRevisionReason =
        'No destinations fit within your budget and distance limits. Try increasing your budget or trip length.';
      continue; // let the loop try another discovery pass
    }

    // 4. Evaluate + rank (pure, deterministic).
    emit('evaluation', 'start');
    evaluation = await evaluateDestinations(llm, kept, prefs);
    emit('evaluation', 'done', {
      chosen: evaluation.chosen?.name ?? null,
      searchRevisionNeeded: evaluation.searchRevisionNeeded,
    });

    if (!evaluation.searchRevisionNeeded && evaluation.chosen) break;
    lastRevisionReason = evaluation.searchRevisionReason || lastRevisionReason;
  }

  if (!evaluation || evaluation.searchRevisionNeeded || !evaluation.chosen) {
    // Honest failure after exhausting the search-revision cap — never silently relax.
    throw httpError(
      422,
      lastRevisionReason ||
        'No destinations fit within your budget and distance limits. Try increasing your budget or trip length.',
    );
  }

  const { chosen, ranked, ineligible = [] } = evaluation;

  // 5. Itinerary generation (LLM proposes; pure budget math + validation).
  emit('itinerary', 'start');
  const { title, summary, itinerary, validation, budgetSummary } = await generateItinerary(
    llm,
    chosen,
    prefs,
  );
  emit('itinerary', 'done', { days: itinerary.length });

  // Assemble a draft recommendation (budget fields are placeholders until stage 6).
  const draft = {
    title,
    summary,
    destination: chosen,
    consideredDestinations: ranked,
    ineligibleDestinations: ineligible,
    itinerary,
    validation,
    budgetSummary,
    safetyNotes: [],
    budget: {
      currency: 'USD',
      limitUsd: prefs.budgetUsd,
      estimatedTotalUsd: 0,
      withinBudget: false,
      breakdown: [],
    },
    meta: {
      provider: meta.provider,
      model: meta.model,
      generatedAt: new Date().toISOString(),
    },
  };

  // 6. Budget validation (pure, authoritative — recomputes totals server-side).
  emit('budgetValidation', 'start');
  const validated = validateBudget(draft, prefs);
  emit('budgetValidation', 'done', {
    withinBudget: validated.budget.withinBudget,
    estimatedTotalUsd: validated.budget.estimatedTotalUsd,
  });

  // Safety-language scrub (pure) before the final contract check.
  const scrubbed = applySafetyLanguage(validated);

  // Final shape check: provider output must satisfy the contract before it leaves.
  const final = TripRecommendationSchema.parse(scrubbed);
  emit('final', 'done');
  return final;
}
