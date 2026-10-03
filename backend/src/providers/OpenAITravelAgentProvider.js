import { TravelAgentProvider } from './TravelAgentProvider.js';
import { runPipeline } from '../agent/pipeline.js';
import { getOpenAIClient } from '../services/openai.client.js';
import { config } from '../config/env.js';

/**
 * OpenAITravelAgentProvider — drives the identical pipeline as the mock, but its `llm`
 * step calls the OpenAI Chat Completions API in JSON mode and validates every stage's
 * output against the Zod schema the stage supplies. On a malformed response it retries
 * once with a corrective instruction before giving up.
 *
 * SECURITY: the API key is read from env via the shared client and never leaves the
 * server. Nothing here is reachable from or exposed to the frontend.
 */
export class OpenAITravelAgentProvider extends TravelAgentProvider {
  name = 'openai';

  constructor() {
    super();
    this.client = getOpenAIClient();
    this.model = config.openai.model;
    if (!this.client) {
      throw new Error('OpenAITravelAgentProvider requires OPENAI_API_KEY to be set.');
    }
  }

  async generateTripStream(preferences, onStage) {
    const llm = makeOpenAILlm(this.client, this.model);
    return runPipeline({
      input: preferences,
      llm,
      meta: { provider: this.name, model: this.model },
      onStage,
    });
  }
}

/**
 * Build an llm(messages, schema) function that calls OpenAI, parses JSON, and validates
 * against the provided Zod schema with a single corrective retry.
 */
function makeOpenAILlm(client, model) {
  return async (messages, schema) => {
    const attempt = async (extraMessages = []) => {
      const completion = await client.chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        temperature: 0.7,
        messages: [...messages, ...extraMessages],
      });
      const raw = completion.choices?.[0]?.message?.content ?? '{}';
      return schema.parse(JSON.parse(raw));
    };

    try {
      return await attempt();
    } catch (firstErr) {
      // One corrective retry: tell the model exactly what was wrong and ask again.
      const correction = {
        role: 'user',
        content:
          'Your previous response was not valid JSON matching the required schema ' +
          `(${firstErr.message}). Respond again with ONLY a valid JSON object that matches ` +
          'the requested shape. No prose, no markdown.',
      };
      return attempt([correction]);
    }
  };
}
