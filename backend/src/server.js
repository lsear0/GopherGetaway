import { createApp } from './app.js';
import { config, hasOpenAIKey } from './config/env.js';

const app = createApp();

// On Vercel the Express service runs as a serverless function: the platform imports this
// module and invokes the exported app per request, so we must NOT bind a port there.
// Locally (`node src/server.js` / `npm run dev`), we start a normal HTTP listener.
// Vercel sets the VERCEL env var in its build/runtime environment.
if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`GopherGetaway backend listening on http://localhost:${config.port}`);
    if (!hasOpenAIKey) {
      // eslint-disable-next-line no-console
      console.warn('No OPENAI_API_KEY set — /api/trips will return mock itineraries.');
    }
  });
}

// The configured Express app is the service entrypoint Vercel invokes.
export default app;
