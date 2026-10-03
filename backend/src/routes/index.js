import { Router } from 'express';

import { healthRouter } from './health.routes.js';
import { tripsRouter } from './trips.routes.js';
import { recommendationsRouter } from './recommendations.routes.js';

export const router = Router();

router.use('/health', healthRouter);
router.use('/trips', tripsRouter); // legacy single-shot endpoint (kept for the in-progress UI)
router.use('/recommendations', recommendationsRouter); // structured agent pipeline
