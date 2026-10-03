import { Router } from 'express';

import { healthRouter } from './health.routes.js';
import { tripsRouter } from './trips.routes.js';

export const router = Router();

router.use('/health', healthRouter);
router.use('/trips', tripsRouter);
