import { TravelAgentProvider } from './TravelAgentProvider.js';
import { runPipeline } from '../agent/pipeline.js';
import { getOpenAIClient, createChatCompletion } from '../services/openai.client.js';
import { config } from '../config/env.js';
import { SAFETY_PROMPT } from '../agent/safety.js';

/**
 * OpenAIMcpTravelAgentProvider (Bear's MCP as a third provider).
 *
 * Drives the identical pipeline as the mock/openai providers, but its injected `llm`
 * runs an autonomous MCP tool-calling loop (bounded by config.openai.maxToolIterations)
 * so discovery/evaluation can be fed with real external travel data.
 *
 * Degradation is layered and NEVER crashes the process:
 *   - no OpenAI key    -> factory already resolved to 'mock' (we never get here)
 *   - no MCP tools     -> fall back to a plain-LLM call (same as the 'openai' provider)
 *   - tool failures    -> loop pushes a normalized error and keeps going
 *   - loop exhaustion  -> fall back to a plain-LLM call for that hand-off
 *
 * MCP modules are imported LAZILY so a missing/broken SDK can never break startup.
 */
export class OpenAIMcpTravelAgentProvider extends TravelAgentProvider {
  name = 'openai+mcp';

  constructor() {
    super();
    this.client = getOpenAIClient();
    this.model = config.openai.model;
    if (!this.client) {
      throw new Error('OpenAIMcpTravelAgentProvider requires OPENAI_API_KEY to be set.');
    }
    this._toolsReady = false;
    this._openAiTools = [];
    this._executor = null;
  }

  async _ensureTools() {
    if (this._toolsReady) return this._openAiTools;
    this._toolsReady = true;
    try {
      // Lazy imports — only touched when this provider actually runs.
      const { getToolRegistry } = await import('../mcp/ToolRegistry.js');
      const { getToolExecutor } = await import('../mcp/ToolExecutor.js');
      const registry = getToolRegistry();
      const { openAiTools, failures } = await registry.refresh();
      this._openAiTools = openAiTools || [];
      this._executor = getToolExecutor();
      if (failures?.length) {
        // eslint-disable-next-line no-console
        console.warn('[openai+mcp] Some MCP servers failed to connect:', failures);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[openai+mcp] MCP unavailable, degrading to plain LLM:', err.message);
      this._openAiTools = [];
      this._executor = null;
    }
    return this._openAiTools;
  }

  async generateTripStream(preferences, onStage) {
    const tools = await this._ensureTools();
    const degraded = tools.length === 0;
    const llm = makeMcpLlm({
      model: this.model,
      tools,
      executor: this._executor,
    });
    return runPipeline({
      input: preferences,
      llm,
      meta: {
        provider: degraded ? 'openai+mcp(degraded:no-tools)' : this.name,
        model: this.model,
      },
      onStage,
    });
  }
}

/**
 * Build an llm(messages, schema) that runs the bounded MCP tool-calling loop and
 * validates the final JSON against the stage's schema. Falls back to a plain,
 * tool-free completion on exhaustion or any MCP error.
 */
function makeMcpLlm({ model, tools, executor }) {
  const maxIterations = config.openai.maxToolIterations;
  const maxToolCallsPerIteration = 4;

  const plainCompletion = async (messages, schema) => {
    const completion = await createChatCompletion({
      messages,
      responseFormat: { type: 'json_object' },
    });
    const raw = completion.choices?.[0]?.message?.content ?? '{}';
    return schema.parse(JSON.parse(extractJson(raw)));
  };

  return async (messages, schema) => {
    // Inject the safety guardrails into the system message.
    const withSafety = [
      { role: 'system', content: SAFETY_PROMPT },
      ...messages,
    ];

    // No tools available -> behave like the plain OpenAI provider.
    if (!tools.length || !executor) {
      return plainCompletion(withSafety, schema);
    }

    const loop = [...withSafety];
    for (let i = 0; i < maxIterations; i += 1) {
      const completion = await createChatCompletion({
        messages: loop,
        tools,
        toolChoice: 'auto',
        responseFormat: { type: 'json_object' },
      });
      const msg = completion.choices?.[0]?.message;
      if (!msg) break;

      loop.push({
        role: 'assistant',
        content: msg.content ?? '',
        ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
      });

      if (msg.tool_calls?.length) {
        const calls = msg.tool_calls.slice(0, maxToolCallsPerIteration);
        const toolMessages = await Promise.all(
          calls.map(async (call) => {
            try {
              const result = await executor.executeTool(call.function.name, call.function.arguments);
              return { role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) };
            } catch (err) {
              return {
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify({ error: err.publicMessage || err.message, code: err.code }),
              };
            }
          }),
        );
        // Any tool calls beyond the per-turn budget get a normalized skip message.
        for (const extra of msg.tool_calls.slice(maxToolCallsPerIteration)) {
          toolMessages.push({
            role: 'tool',
            tool_call_id: extra.id,
            content: JSON.stringify({ skipped: 'per-turn tool budget exceeded' }),
          });
        }
        loop.push(...toolMessages);
        continue;
      }

      // Final structured answer.
      try {
        return schema.parse(JSON.parse(extractJson(msg.content ?? '{}')));
      } catch {
        break; // malformed final JSON -> fall back below
      }
    }

    // Loop exhausted or malformed -> degrade to a plain completion for this hand-off.
    // eslint-disable-next-line no-console
    console.warn('[openai+mcp] tool loop did not produce valid JSON; falling back to plain LLM.');
    return plainCompletion(withSafety, schema);
  };
}

function extractJson(raw) {
  const trimmed = String(raw).trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]+?)\s*```$/i);
  return fenced?.[1] || trimmed;
}
