/**
 * Safety-language rules (Nupur's spec), applied throughout the pipeline.
 *
 * Two surfaces:
 *   1. SAFETY_PROMPT — text injected into every LLM/tool-loop system prompt.
 *   2. applySafetyLanguage(recommendation) — a pure post-processor that scrubs banned
 *      absolute safety claims before the final schema parse.
 *
 * Rule of thumb: never assert that an area/listing/host/activity is objectively "safe"
 * or "unsafe" without reliable data. Unknown is never coerced to "acceptable".
 */

export const SAFETY_PROMPT = [
  'Safety-language rules (follow exactly):',
  '- Never claim a place, listing, host, or activity is objectively "safe" or "unsafe"',
  '  without reliable, sourced data. Describe only what the data supports.',
  '- When data is missing, say so explicitly (e.g. "could not be evaluated with the',
  '  available data"). Never present an unknown as acceptable.',
  '- Never fabricate prices, availability, amenities, or safety ratings.',
  '- Do not label any numeric score as a safety or objective-quality rating.',
].join('\n');

const BANNED_PHRASES = [
  /\bcompletely safe\b/gi,
  /\bdefinitely safe\b/gi,
  /\btotally safe\b/gi,
  /\b100% safe\b/gi,
  /\bperfectly safe\b/gi,
  /\bguaranteed safe\b/gi,
  /\bnothing to worry about\b/gi,
  /\babsolutely safe\b/gi,
];

const DISCLOSURE =
  'Safety could not be verified with the available data; verify locally before you travel.';

/**
 * Replace any sentence containing a banned absolute-safety phrase with a factual
 * uncertainty disclosure, and collect those disclosures into `safetyNotes`.
 * @param {string} text
 * @returns {{ text: string, rewritten: boolean }}
 */
function scrubText(text) {
  if (typeof text !== 'string' || !text) return { text, rewritten: false };
  const hasBanned = BANNED_PHRASES.some((re) => {
    re.lastIndex = 0;
    return re.test(text);
  });
  if (!hasBanned) return { text, rewritten: false };
  return { text: DISCLOSURE, rewritten: true };
}

/**
 * Pure post-processor. Scrubs banned safety phrasing from user-facing strings and adds a
 * safetyNotes entry when anything was rewritten. Returns a new object (does not mutate).
 * @param {object} recommendation
 * @returns {object}
 */
export function applySafetyLanguage(recommendation) {
  if (!recommendation || typeof recommendation !== 'object') return recommendation;

  let rewritten = false;
  const next = structuredClone(recommendation);

  const summary = scrubText(next.summary);
  next.summary = summary.text;
  rewritten = rewritten || summary.rewritten;

  if (next.destination?.whyItFits) {
    const r = scrubText(next.destination.whyItFits);
    next.destination.whyItFits = r.text;
    rewritten = rewritten || r.rewritten;
  }

  if (Array.isArray(next.itinerary)) {
    for (const day of next.itinerary) {
      const ds = scrubText(day.summary);
      day.summary = ds.text;
      rewritten = rewritten || ds.rewritten;
      if (Array.isArray(day.activities)) {
        for (const a of day.activities) {
          const ad = scrubText(a.description);
          a.description = ad.text;
          rewritten = rewritten || ad.rewritten;
        }
      }
    }
  }

  if (rewritten) {
    const notes = Array.isArray(next.safetyNotes) ? next.safetyNotes : [];
    if (!notes.includes(DISCLOSURE)) notes.push(DISCLOSURE);
    next.safetyNotes = notes;
    // eslint-disable-next-line no-console
    console.warn('[safety] Rewrote an unsupported absolute-safety claim in a recommendation.');
  }

  return next;
}
