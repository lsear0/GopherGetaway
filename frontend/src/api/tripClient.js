/**
 * Thin client for the backend trip API. In development, requests to /api are
 * proxied to the backend by Vite (see vite.config.js).
 */

/**
 * Request a generated trip for the given student profile.
 * @param {object} profile - income, interests, tripLengthDays, departureCity, notes
 * @returns {Promise<{ trip: object, source: 'openai' | 'mock' }>}
 */
export async function requestTrip(profile) {
  const res = await fetch('/api/trips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }

  return res.json();
}
