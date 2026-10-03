import { NormalizedPreferencesSchema } from '../../schemas/preferences.schema.js';

/**
 * STAGE 1 — Preference normalization.
 *
 * Takes already-validated input (from the Zod request schema) and produces the clean,
 * canonical NormalizedPreferences every downstream stage consumes. This is pure,
 * deterministic logic — no LLM — so the agent always starts from trustworthy numbers.
 *
 * Crucially, the server derives per-day budget here rather than accepting any such
 * figure from the client.
 *
 * @param {import('../../schemas/preferences.schema.js').PreferencesInput} input
 * @returns {import('../../schemas/preferences.schema.js').NormalizedPreferences}
 */
export function normalizePreferences(input) {
  // De-duplicate + lower-case interests; guarantee at least one so later stages have
  // something to prioritize.
  const interests = dedupe(input.interests.map((i) => i.toLowerCase().trim()).filter(Boolean));
  if (interests.length === 0) interests.push('general sightseeing');

  const dailyBudgetUsd = round2(input.budgetUsd / input.tripLengthDays);

  const normalized = {
    ...input,
    interests,
    dailyBudgetUsd,
  };

  // Validate our own output so a bug here fails loudly instead of silently.
  return NormalizedPreferencesSchema.parse(normalized);
}

function dedupe(arr) {
  return [...new Set(arr)];
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
