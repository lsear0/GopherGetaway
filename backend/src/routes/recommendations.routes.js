import { Router } from 'express';

import { validateBody } from '../middleware/validate.js';
import { generationRateLimiter } from '../middleware/rateLimit.js';
import { PreferencesInputSchema } from '../schemas/preferences.schema.js';
import {
  createRecommendation,
  streamRecommendation,
} from '../controllers/recommendations.controller.js';

export const recommendationsRouter = Router();

// Rate-limit + server-side validate every generation request before it reaches a controller.
const guards = [generationRateLimiter, validateBody(PreferencesInputSchema)];

// POST /api/recommendations         — non-streaming JSON
recommendationsRouter.post('/', guards, createRecommendation);

// POST /api/recommendations/stream  — SSE progressive generation
recommendationsRouter.post('/stream', guards, streamRecommendation);
