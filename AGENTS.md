# AGENTS.md

## Scope

This file applies to work inside `backend/`.

The backend is a Node + Express API for GopherGetaway. It validates student trip profiles, orchestrates OpenAI trip generation, and connects to external travel tools through MCP.

## Architecture

- `src/server.js`: process startup and graceful shutdown
- `src/app.js`: Express app factory
- `src/routes/`: API route wiring
- `src/controllers/`: request validation and response shaping only
- `src/services/openai.client.js`: OpenAI client wrapper
- `src/services/trip.service.js`: main trip-generation orchestration
- `src/mcp/McpClientManager.js`: MCP transport/client lifecycle
- `src/mcp/ToolRegistry.js`: tool discovery and model-facing tool schemas
- `src/mcp/ToolExecutor.js`: MCP tool dispatch, timeouts, truncation, and normalization
- `src/config/env.js`: environment validation and config access
- `src/config/mcpServers.json`: MCP manifest
- `src/middleware/errorHandler.js`: centralized error handling

## Backend rules

- Keep controllers thin.
- Put business logic in services.
- Keep OpenAI request construction centralized where practical.
- Keep MCP responsibilities split across manager / registry / executor.
- Do not crash the Express process because an upstream MCP server fails.
- Normalize user-facing failures through `errorHandler.js`.

## MCP rules

- Tool names exposed to the model must remain namespaced as `serverName__toolName`.
- Support configured transports without hardcoding credentials.
- Read MCP server config from `src/config/mcpServers.json` and environment overrides from `src/config/env.js`.
- Preserve timeout and response truncation safeguards.
- Prefer graceful degradation when a provider is unavailable.

## Environment and secrets

Use `backend/.env.example` as the source of truth for required and optional variables.

Important variables include:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_MAX_TOOL_ITERATIONS`
- `MCP_REQUEST_TIMEOUT_MS`
- `MCP_MAX_TOOL_RESPONSE_CHARS`
- `STAYINGAPI_BEARER_TOKEN`

Do not commit secrets. Do not hardcode bearer tokens, API keys, or deployment-specific local paths.

If `OPENAI_API_KEY` is absent, preserve the current mock-itinerary fallback behavior.

## Coding conventions

- Use ES modules.
- Prefer additive, minimal changes over broad refactors.
- Keep modules small and focused.
- Keep HTTP concerns out of deep service internals.
- Preserve existing JSON response shapes unless intentionally changing the API contract.

## Required verification

For MCP or orchestration changes, run:

```bash
npm run test:mcp
```

Also smoke-test the API when relevant:

- `POST /api/trips` success path
- `POST /api/trips` validation failure path
- structured MCP error responses if MCP behavior changed

## Common commands

```bash
npm install
npm run dev
npm run test:mcp
npm start
```

## Guardrails for trip generation

- Preserve JSON-only trip output assumptions.
- Preserve the OpenAI tool-calling loop unless intentionally redesigning it.
- Keep tool payloads bounded to avoid context overflow.
- Ensure upstream failures are surfaced as normalized HTTP errors or safe degraded behavior.

## Good future improvements

- Add integration tests for `/api/trips`.
- Improve degraded-provider reporting when MCP discovery fails.
- Add remote MCP test coverage beyond the mock stdio server.
