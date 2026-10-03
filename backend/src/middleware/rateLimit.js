import rateLimit from 'express-rate-limit';

import { config } from '../config/env.js';

/**
 * Rate limiter for the generation endpoint. LLM calls are expensive, so we cap how often
 * a single client (by IP) can trigger generation. Limits are configurable via env
 * (RATE_LIMIT_WINDOW_MS / RATE_LIMIT_MAX).
 */
export const generationRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a bit before generating again.' },
});
