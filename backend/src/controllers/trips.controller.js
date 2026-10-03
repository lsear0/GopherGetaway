import { httpError } from '../middleware/errorHandler.js';
import { buildTrip } from '../services/trip.service.js';

/**
 * Validates the incoming student profile, then delegates to the trip service.
 * Controllers stay thin: parse/validate input, call a service, shape the response.
 */
export async function generateTrip(req, res, next) {
  try {
    const profile = normalizeProfile(req.body);
    const { trip, source } = await buildTrip(profile);
    res.json({ trip, source });
  } catch (err) {
    next(err);
  }
}

/** Validate and normalize the raw request body into a clean profile object. */
function normalizeProfile(body = {}) {
  const { income, interests, tripLengthDays, departureCity, notes } = body;

  if (income != null && (typeof income !== 'number' || income < 0)) {
    throw httpError(400, 'Income must be a non-negative number.');
  }

  if (interests != null && !Array.isArray(interests)) {
    throw httpError(400, 'Interests must be a list.');
  }

  if (
    tripLengthDays != null &&
    (typeof tripLengthDays !== 'number' || tripLengthDays < 1 || tripLengthDays > 30)
  ) {
    throw httpError(400, 'Trip length must be between 1 and 30 days.');
  }

  return {
    income: income ?? null,
    interests: Array.isArray(interests) ? interests.filter(Boolean) : [],
    tripLengthDays: tripLengthDays ?? 3,
    departureCity: typeof departureCity === 'string' ? departureCity.trim() : 'Minneapolis',
    notes: typeof notes === 'string' ? notes.trim() : '',
  };
}
