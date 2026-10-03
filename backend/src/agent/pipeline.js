import { TripRecommendationSchema } from '../schemas/recommendation.schema.js';
import { httpError } from '../middleware/errorHandler.js';

import { normalizePreferences } from './stages/normalize.js';
import { discoverDestinations } from './stages/discovery.js';
import { filterByBudget } from './stages/budgetFilter.js';
import { evaluateDestinations } from './stages/evaluation.js';
import { generateItinerary } from './stages/itinerary.js';
import { validateBudget } from './stages/budgetValidation.js';

/**
 * The structured travel-agent pipeline.
 *
 *   validated input
 *        ↓ normalize           (pure)
 *        ↓ discover            (LLM)
 *        ↓ budget filter       (pure)
 *        ↓ evaluate            (LLM)
 *        ↓ itinerary           (LLM)
 *        ↓ budget validation   (pure, authoritative)
 *        → final response
 *
 * Both the mock and real providers call this exact function; they differ only in the
 * `llm` step they inject. Progress is reported through `onStage` so a controller can
 * stream it to the client without the pipeline knowing anything about HTTP.
 *
 * @param {object} params
 * @param {import('../schemas/preferences.schema.js').PreferencesInput} params.input - validated input
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

  // 2. Discover candidate destinations (LLM).
  emit('discovery', 'start');
  const candidates = await discoverDestinations(llm, prefs);
  emit('discovery', 'done', { count: candidates.length });

  // 3. Budget filter (pure — enforces the ceiling in code).
  emit('budgetFilter', 'start');
  const { kept, rejected } = filterByBudget(candidates, prefs);
  if (kept.length === 0) {
    // Nothing affordable was found. Fail with a clear, user-facing message.
    throw httpError(
      422,
      'No destinations fit within your budget and distance limits. Try increasing your budget or trip length.',
    );
  }
  emit('budgetFilter', 'done', { kept: kept.length, rejected: rejected.length });

  // 4. Evaluate + rank (LLM).
  emit('evaluation', 'start');
  const { chosen, ranked } = await evaluateDestinations(llm, kept, prefs);
  emit('evaluation', 'done', { chosen: chosen.name });

  // 5. Itinerary generation (LLM).
  emit('itinerary', 'start');
  const { title, summary, itinerary } = await generateItinerary(llm, chosen, prefs);
  emit('itinerary', 'done', { days: itinerary.length });

  // Assemble a draft recommendation (budget fields are placeholders until stage 6).
  const draft = {
    title,
    summary,
    destination: chosen,
    consideredDestinations: ranked,
    itinerary,
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

  // Final shape check: provider output must satisfy the contract before it leaves.
  const final = TripRecommendationSchema.parse(validated);
  emit('final', 'done');
  return final;
}
