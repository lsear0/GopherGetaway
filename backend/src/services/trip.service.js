import { config } from '../config/env.js';
import { getOpenAIClient } from './openai.client.js';

/**
 * Core trip-building logic.
 *
 * Takes a normalized student profile and returns a structured itinerary.
 * If an OpenAI client is available it asks the model for a trip; otherwise it
 * returns a clearly-labeled mock so the frontend can be developed without a key.
 *
 * @param {object} profile
 * @param {number|null} profile.income
 * @param {string[]} profile.interests
 * @param {number} profile.tripLengthDays
 * @param {string} profile.departureCity
 * @param {string} profile.notes
 * @returns {Promise<{ trip: object, source: 'openai' | 'mock' }>}
 */
export async function buildTrip(profile) {
  const openai = getOpenAIClient();

  if (!openai) {
    return { trip: buildMockTrip(profile), source: 'mock' };
  }

  const completion = await openai.chat.completions.create({
    model: config.openai.model,
    // Ask the model to return strict JSON we can parse into our trip shape.
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(profile) },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content ?? '{}';
  const trip = JSON.parse(raw);
  return { trip, source: 'openai' };
}

const SYSTEM_PROMPT = `You are a travel agent for University of Minnesota students.
You build budget-conscious, interest-driven trips. Always respond with a JSON object
matching this shape:
{
  "title": string,
  "summary": string,
  "estimatedBudgetUsd": number,
  "days": [{ "day": number, "title": string, "activities": string[] }]
}
Keep budgets realistic for a student's stated income. Do not include any text outside the JSON.`;

/** Turns the student profile into a natural-language prompt for the model. */
function buildUserPrompt(profile) {
  const interests = profile.interests.length ? profile.interests.join(', ') : 'open to anything';
  const income = profile.income != null ? `$${profile.income}/year` : 'not specified';

  return [
    `Plan a ${profile.tripLengthDays}-day trip.`,
    `Departure city: ${profile.departureCity}.`,
    `Annual income: ${income}.`,
    `Interests: ${interests}.`,
    profile.notes ? `Additional notes: ${profile.notes}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** A deterministic placeholder itinerary used when no OpenAI key is configured. */
function buildMockTrip(profile) {
  const days = Array.from({ length: profile.tripLengthDays }, (_, i) => ({
    day: i + 1,
    title: `Day ${i + 1}: Explore`,
    activities: [
      'Placeholder activity (set OPENAI_API_KEY for real suggestions)',
      profile.interests[i % Math.max(profile.interests.length, 1)] || 'Free exploration',
    ],
  }));

  return {
    title: `Mock trip from ${profile.departureCity}`,
    summary:
      'This is sample data. Add an OPENAI_API_KEY to the backend .env to generate a real trip.',
    estimatedBudgetUsd: Math.round((profile.income ?? 10000) * 0.05),
    days,
  };
}
