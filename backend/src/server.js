import { createApp } from './app.js';
import { config, hasOpenAIKey } from './config/env.js';

const app = createApp();

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`GopherTrip backend listening on http://localhost:${config.port}`);
  if (!hasOpenAIKey) {
    // eslint-disable-next-line no-console
    console.warn('No OPENAI_API_KEY set — /api/trips will return mock itineraries.');
  }
});
