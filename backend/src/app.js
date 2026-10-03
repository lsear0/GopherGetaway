import express from 'express';
import cors from 'cors';

import { router } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

/**
 * Builds and configures the Express application.
 * Kept separate from server.js so it can be imported in tests without binding a port.
 */
export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // All API routes are mounted under /api.
  app.use('/api', router);

  // 404 for unknown routes.
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Central error handler (must be last).
  app.use(errorHandler);

  return app;
}
