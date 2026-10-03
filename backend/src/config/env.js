import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

dotenv.config();

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_OPENAI_MAX_TOOL_ITERATIONS = 6;
const DEFAULT_MCP_REQUEST_TIMEOUT_MS = 45_000;
const DEFAULT_MCP_MAX_TOOL_RESPONSE_CHARS = 12_000;
const DEFAULT_AGENT_MAX_SEARCH_REVISIONS = 2;
const MCP_MANIFEST_PATH = fileURLToPath(new URL('./mcpServers.json', import.meta.url));
const SCORING_WEIGHTS_PATH = fileURLToPath(new URL('./scoringWeights.json', import.meta.url));

function readPositiveInteger(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

function readOptionalUrl(name) {
  const raw = process.env[name]?.trim();
  if (!raw) return '';

  try {
    return new URL(raw).toString();
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
}

function sanitizeServerName(serverName) {
  return serverName.replace(/[^a-z0-9]/gi, '_').toUpperCase();
}

function readOptionalJsonArray(name) {
  const raw = process.env[name];
  if (raw == null || raw === '') return undefined;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${name} must be a valid JSON array of strings.`);
  }

  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new Error(`${name} must be a valid JSON array of strings.`);
  }

  return parsed;
}

/**
 * Per-server env overrides for the MCP manifest (Bear's helper, kept verbatim).
 */
export function getMcpServerOverride(serverName) {
  const prefix = `MCP_${sanitizeServerName(serverName)}`;
  const command = process.env[`${prefix}_COMMAND`]?.trim() || '';
  const args = readOptionalJsonArray(`${prefix}_ARGS`);
  const url = readOptionalUrl(`${prefix}_URL`);

  return {
    ...(command ? { command } : {}),
    ...(args ? { args } : {}),
    ...(url ? { url } : {}),
  };
}

/**
 * Load the scoring weights from config so weights live in configuration, not inline in
 * code (Nupur's rule). Each weight is overridable by env (SCORING_WEIGHT_<NAME>).
 */
function loadScoringWeights() {
  // Lazy require via import.meta — read synchronously at startup from JSON.
  // Weights are small; a static import of JSON keeps this simple and ES-module friendly.
  const defaults = {
    budgetFit: 0.3,
    preferenceMatch: 0.25,
    locationFit: 0.15,
    transportationFit: 0.15,
    interestMatch: 0.15,
  };

  // Allow per-weight env overrides, e.g. SCORING_WEIGHT_BUDGET_FIT=0.4
  const resolved = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const envName = `SCORING_WEIGHT_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
    const raw = process.env[envName];
    if (raw != null && raw !== '') {
      const value = Number(raw);
      if (!Number.isNaN(value)) resolved[key] = value;
    }
  }
  return resolved;
}

/**
 * Centralized, validated environment configuration.
 * Importing from here (instead of reading process.env everywhere) keeps config
 * in one place and makes it easy to see what the app depends on.
 */
export const config = {
  port: Number(process.env.PORT) || 3001,

  // Which TravelAgentProvider to use: 'auto' | 'mock' | 'openai' | 'openai+mcp'.
  // 'auto' picks the richest available provider given the key + MCP manifest.
  provider: (process.env.TRAVEL_AGENT_PROVIDER || 'auto').toLowerCase(),

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    maxToolIterations: readPositiveInteger(
      'OPENAI_MAX_TOOL_ITERATIONS',
      DEFAULT_OPENAI_MAX_TOOL_ITERATIONS,
    ),
  },

  // Bear's MCP integration config.
  mcp: {
    manifestPath: MCP_MANIFEST_PATH,
    requestTimeoutMs: readPositiveInteger('MCP_REQUEST_TIMEOUT_MS', DEFAULT_MCP_REQUEST_TIMEOUT_MS),
    maxToolResponseChars: readPositiveInteger(
      'MCP_MAX_TOOL_RESPONSE_CHARS',
      DEFAULT_MCP_MAX_TOOL_RESPONSE_CHARS,
    ),
    clientName: 'gophertrip-backend',
    clientVersion: '0.1.0',
    stayingApiBearerToken: process.env.STAYINGAPI_BEARER_TOKEN || '',
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    weatherApiKey: process.env.WEATHER_API_KEY || '',
  },

  // Nupur's orchestration cap + transparent scoring weights.
  agent: {
    maxSearchRevisions: readPositiveInteger(
      'AGENT_MAX_SEARCH_REVISIONS',
      DEFAULT_AGENT_MAX_SEARCH_REVISIONS,
    ),
  },
  scoring: {
    weightsPath: SCORING_WEIGHTS_PATH,
    weights: loadScoringWeights(),
  },

  // Rate limiting for the generation endpoint.
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
    max: Number(process.env.RATE_LIMIT_MAX) || 20, // requests per window per IP
  },
};

/** Whether a real OpenAI key is configured. When false, the service uses mock data. */
export const hasOpenAIKey = Boolean(config.openai.apiKey);

/**
 * Cheap, synchronous check of whether the MCP manifest has at least one enabled server.
 * Reads the file once; never throws (returns false on any error) so provider selection
 * can never crash at startup.
 * @returns {boolean}
 */
export function hasEnabledMcpServer() {
  try {
    // Synchronous read is fine: this runs once during provider selection.
    const raw = readFileSync(config.mcp.manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    const servers = Array.isArray(parsed?.servers) ? parsed.servers : [];
    return servers.some((s) => s.enabled !== false);
  } catch {
    return false;
  }
}

/**
 * Resolve the effective provider name given config + available credentials.
 * Never throws: falls back to 'mock' when a real provider is requested but no key exists.
 * @returns {'mock' | 'openai' | 'openai+mcp'}
 */
export function resolveProviderName() {
  if (config.provider === 'mock') return 'mock';
  if (config.provider === 'openai') return hasOpenAIKey ? 'openai' : 'mock';
  if (config.provider === 'openai+mcp') return hasOpenAIKey ? 'openai+mcp' : 'mock';
  // 'auto' (default): pick the richest available path.
  if (!hasOpenAIKey) return 'mock';
  return hasEnabledMcpServer() ? 'openai+mcp' : 'openai';
}
