import { Router } from 'express';

import { generateTrip } from '../controllers/trips.controller.js';

export const tripsRouter = Router();

// POST /api/trips — build a trip from a student profile.
tripsRouter.post('/', generateTrip);
