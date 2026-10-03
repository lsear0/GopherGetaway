# GopherTrip — Unified Merge Technical Design

## Overview

GopherTrip is an AI travel agent for University of Minnesota students. This design merges the best ideas from four sibling versions into the existing top-level scaffold, which becomes the single unified project living in the worktree at `.worktrees/merge-unified/` (its `backend/` and `frontend/`). The four `TravelAgent * Version` folders are read-only references; nothing in them is modified.

The base top-level project is kept as the skeleton because it already has the strongest architecture: a provider-agnostic, staged pipeline (`normalize → discover → budgetFilter → evaluate → itinerary → budgetValidation`) where the two budget stages are pure code and the LLM-driven stages are injected through a `TravelAgentProvider` abstraction, all guarded by Zod schemas at the trust boundary. The merge layers three capabilities onto that skeleton:

1. **Bear's MCP layer** — a Model Context Protocol integration (`McpClientManager`, `ToolRegistry`, `ToolExecutor`) plus an autonomous OpenAI tool-calling loop, exposed as a **third provider** (`openai+mcp`) that feeds the pipeline with real external travel data instead of LLM-invented destinations and accommodations.
2. **Nupur's domain rulebook** — the three skill specs become the pipeline's *actual deterministic logic*: a code-driven accommodation/destination evaluator (eligible/ineligible, hard-constraint violations, config-driven scoring weights, honest unknowns), an itinerary stage that emits a validation object and required/recommended/optional tiers with deterministic budget math, and an orchestration layer that enforces a maximum search-revision iteration cap. Safety-language rules apply throughout.
3. **Verayn's UX polish** — an editable accessible itinerary with adjustment toggles and `aria-live` announcements, scored "boarding pass" recommendation cards on the results page, and `frontend_design.md` adopted as the project's design language — layered onto the base TypeScript `PlanWizard` and the existing accessibility system.

The single highest-risk, highest-value change is **reshaping `discover` and `evaluate` so they consume MCP tool output and the deterministic evaluator rather than invented data**. That part is specified in the most detail (sections 3–5), including the explicit data contracts between stages and the degradation path.

### Locked technology stack

This is fixed once the design is approved:

- **Backend:** Node.js ≥ 18, ES modules, Express 4.19, Zod 3.23 (schemas/validation), `express-rate-limit` 7, `openai` 4.56, `@modelcontextprotocol/sdk` ^1.32 (new), `dotenv` 16. No TypeScript on the backend (base backend is plain JS with JSDoc; keep it).
- **Frontend:** React 18 + Vite, TypeScript for the planner/results domain (base already is), React Router. Keep the existing accessibility context. No new state library.
- **Protocols:** HTTP JSON + Server-Sent Events for progressive generation (already present). MCP over stdio / SSE / streamableHttp (Bear's transports).
- **Data store:** none — the app is stateless per request; the frontend persists the questionnaire in `localStorage` only.

No other frameworks are introduced.

---

## 1. Backend skeleton — what stays unchanged

The following are kept exactly as the base top-level backend has them, because they are the architectural backbone and already satisfy the brief's constraints:

- `src/agent/pipeline.js` — the six-stage orchestrator and its `onStage` progress protocol. The stage *sequence* is preserved; the *contents* of `discover`, `evaluate`, and `itinerary` are reshaped (sections 3–5). `normalize`, `budgetFilter`, and `budgetValidation` are preserved as pure, authoritative code.
- `src/providers/TravelAgentProvider.js` — the base class / contract (`name`, `generateTripStream`, `generateTrip`).
- `src/schemas/preferences.schema.js` and `src/schemas/recommendation.schema.js` — the Zod trust boundary. These are *extended* (additive fields only) but never loosened.
- `src/controllers/recommendations.controller.js`, `src/routes/recommendations.routes.js`, `src/middleware/*` — thin controllers, rate limiting, body validation, SSE. Unchanged except that the error handler gains the MCP error classes (section 2).
- `src/agent/stages/normalize.js`, `budgetFilter.js`, `budgetValidation.js` — pure stages. Budget math stays deterministic in code and is never delegated to the LLM. `budgetValidation` remains the single authoritative budget check.

The legacy `src/services/trip.service.js` + `/api/trips` surface in the base is a parallel older path. It is **retained but deprecated**: the unified product uses `/api/recommendations`. We do not expand `trips.service`; Bear's richer `trip.service.js` logic is adapted into the new provider instead (section 3). Rationale: `/api/recommendations` is the schema-validated, pipeline-driven surface the frontend will target; keeping two live orchestration paths would violate the "logic in one place" guardrail.

---

## 2. Inserting Bear's MCP layer

### 2.1 Files copied in (verbatim, then adjusted for imports)

Copied from `TravelAgent Bear Version/TravelAgent/backend/` into the merged `backend/`:

- `src/mcp/McpClientManager.js` — connection lifecycle + stdio/SSE/streamableHttp transports, env-placeholder interpolation, per-server status snapshot, graceful `shutdown()`. Copied unchanged.
- `src/mcp/ToolRegistry.js` — lists tools per enabled server, namespaces them `serverName__toolName`, converts to OpenAI tool schema. Copied unchanged.
- `src/mcp/ToolExecutor.js` — executes a namespaced tool with timeout, truncates responses to `maxToolResponseChars`, normalizes failures into `McpToolExecutionError`. Copied unchanged.
- `src/config/mcpServers.json` — the MCP manifest (`stayingapi` enabled; `googleMaps`, `weather`, `multiDomainTravel` present but disabled). Copied unchanged.
- `scripts/testMcpConnection.js` and `scripts/mockMcpServer.js` — the `test:mcp` diagnostic and its in-process mock stdio MCP server. Copied unchanged.

### 2.2 Files that must be reconciled (two versions exist)

The base backend and Bear both have `config/env.js`, `middleware/errorHandler.js`, and `services/openai.client.js`. These are **merged**, not overwritten, so the base's pipeline features (provider selection, rate limiting) and Bear's MCP features coexist.

**`src/config/env.js`** — union of both:

- Keep base `provider` resolution, `rateLimit`, `openai.apiKey/model`, `hasOpenAIKey`.
- Add from Bear: `openai.maxToolIterations` (default 6, `OPENAI_MAX_TOOL_ITERATIONS`), the whole `mcp` block (`manifestPath` resolved via `fileURLToPath(new URL('./mcpServers.json', import.meta.url))`, `requestTimeoutMs` default 45000, `maxToolResponseChars` default 12000, `clientName`, `clientVersion`, and the three API-key passthroughs `stayingApiBearerToken`/`googleMapsApiKey`/`weatherApiKey`), plus `getMcpServerOverride(serverName)` and its helpers (`readPositiveInteger`, `readOptionalUrl`, `readOptionalJsonArray`, `sanitizeServerName`).
- Extend `resolveProviderName()` to return `'mock' | 'openai' | 'openai+mcp'` (section 3.2).

**`src/middleware/errorHandler.js`** — the base version is kept and gains Bear's `McpConnectionError` (status 502, code `MCP_CONNECTION_ERROR`) and `McpToolExecutionError` (status 502, code `MCP_TOOL_EXECUTION_ERROR`) subclasses, plus the `HttpError` base used by both. The base already exports `httpError`; keep its signature. These classes are what `McpClientManager`/`ToolExecutor` import, so the MCP files work unchanged.

**`src/services/openai.client.js`** — union: keep base `getOpenAIClient()` (lazy singleton, returns `null` when no key), add Bear's `createChatCompletion({ messages, tools, toolChoice, responseFormat })` wrapper (centralizes request formatting, maps SDK errors to `httpError(502,…)`). The `openai+mcp` provider's tool-calling loop uses `createChatCompletion`; the plain `openai` provider keeps using the client directly as it does today.

### 2.3 package.json

Add `"@modelcontextprotocol/sdk": "^1.32.0"` to `backend/dependencies` (pinned caret as Bear uses). Add `"test:mcp": "node scripts/testMcpConnection.js"` to `scripts`. Keep existing deps (`zod`, `express-rate-limit`) which Bear's package lacked. Dependency note: `@modelcontextprotocol/sdk` is the official MCP SDK and matches the version Bear already pinned — no typosquat risk.

### 2.4 Secrets

All MCP credentials stay in env (`STAYINGAPI_BEARER_TOKEN`, `GOOGLE_MAPS_API_KEY`, `WEATHER_API_KEY`) and are interpolated into the manifest by `McpClientManager`'s `replaceEnvPlaceholders`. No secret is hardcoded and none is ever included in the `TripRecommendation` returned to the frontend (the recommendation schema has no field for them, and the Zod `.parse` at the end of the pipeline strips unknown keys). A `backend/.env.example` is added listing every variable by name with empty values.

---

## 3. The provider reshape (highest-value section)

### 3.1 Three providers, one pipeline

All three providers call the *same* `runPipeline(...)`. They differ only in the `llm`-equivalent capabilities injected. To support MCP-fed stages without changing the pure stages, the pipeline's injected dependency is widened from a single `llm` function to a small **capability object** `agent`:

```
agent = {
  llm(messages, zodSchema) -> Promise<parsed>      // existing LLM-with-retry contract
  discoverCandidates(prefs) -> Promise<RawCandidate[]>   // NEW: data acquisition
  fetchAccommodations(prefs, destination) -> Promise<RawAccommodation[]>  // NEW
  meta: { provider, model? }
}
```

- `MockTravelAgentProvider` implements `discoverCandidates`/`fetchAccommodations` with deterministic seeded data (today's mock destinations, plus mock accommodations shaped like the normalized schema).
- `OpenAITravelAgentProvider` implements `discoverCandidates` by asking the LLM for candidate destinations (today's discovery prompt) and `fetchAccommodations` by asking the LLM to *estimate* listings (clearly flagged `source.provider = 'llm-estimate'`, `confidence: 'estimate'`).
- `OpenAIMcpTravelAgentProvider` (**new**) implements `discoverCandidates`/`fetchAccommodations` by running the autonomous MCP tool-calling loop and returning *real* tool data normalized to the internal schema.

`pipeline.js` changes: `discoverDestinations(agent, prefs)` calls `agent.discoverCandidates(prefs)`; `evaluateDestinations(agent, kept, prefs)` is now deterministic (section 4) and calls `agent.fetchAccommodations` when it needs lodging data; `generateItinerary(agent, chosen, prefs)` uses `agent.llm` for prose but computes budget deterministically (section 5). The stage signatures take `agent` instead of `llm`; the three pure stages are untouched.

Rationale for a capability object over three separate pipelines: it keeps one orchestrator (the brief's "logic in one place"), keeps the pure budget stages authoritative regardless of provider, and makes the mock a true structural stand-in for `openai+mcp` so tests exercise the real control flow.

### 3.2 Provider factory + selection

`src/providers/index.js` switch gains the third case:

```
resolveProviderName():  // in env.js
  if provider === 'mock'        -> 'mock'
  if provider === 'openai'      -> hasOpenAIKey ? 'openai'      : 'mock'
  if provider === 'openai+mcp'  -> hasOpenAIKey ? 'openai+mcp'  : 'mock'
  if provider === 'auto' (default):
       if !hasOpenAIKey -> 'mock'
       else if any MCP server is enabled in the manifest -> 'openai+mcp'
       else -> 'openai'
```

MCP availability for `'auto'` is decided *cheaply* by reading the manifest's enabled-server count (no network). Actual connection health is handled at request time by the degradation path (3.5), so selecting `openai+mcp` can never crash startup.

### 3.3 Data contract: discover → budgetFilter → evaluate → itinerary

This is the spine of the merge. Every stage boundary has a concrete, Zod-validated shape so the deterministic stages can trust their inputs.

**(a) `RawCandidate` — output of `discoverCandidates` (any provider), input to `budgetFilter`.** Superset of today's discovery item, with provenance and honest unknowns:

```
RawCandidate {
  name: string
  country: string = ''
  distanceKm: number >= 0            // from routing MCP when available; else LLM estimate; else null→flagged unknown
  estimatedTotalCostUsd: number >= 0 // rough; refined later
  whyItFits: string
  matchedInterests: string[] = []
  source: {
    provider: string                 // e.g. 'stayingapi', 'llm-estimate', 'mock'
    toolName?: string                // namespaced serverName__toolName when from MCP
    url?: string
    retrievedAt?: string
  }
  unknownFields: string[] = []       // names of fields that could not be reliably sourced
}
```

`budgetFilter` is unchanged logic but now carries `source`/`unknownFields` through on kept/rejected items (spread already does this).

**(b) `RawAccommodation` — output of `fetchAccommodations`, input to the evaluator.** This is Nupur's normalized accommodation schema (section 4.1). Discovery of lodging is deferred into the evaluate stage so the evaluator only fetches listings for the budget-surviving destinations (bounded fan-out).

**(c) `EvaluatedCandidate` — output of the deterministic evaluate stage, input to itinerary.** Section 4.2.

**(d) `ItineraryResult` — output of itinerary, input to `budgetValidation`.** Section 5.

Each shape is a named Zod schema in `src/schemas/recommendation.schema.js` (additive). The pipeline `.parse`s provider output at each hand-off so a misbehaving MCP tool or model is caught server-side, exactly as the base already does for the final recommendation.

### 3.4 The autonomous MCP tool-calling loop (openai+mcp)

Lives in `src/agent/mcp/toolLoop.js` (new), adapted from Bear's `trip.service.js` loop, generalized to return structured domain data instead of a free-form trip. One loop invocation serves one data-acquisition goal (discovery, or accommodations for one destination).

```
runToolLoop({ goalPrompt, resultSchema, prefs }) :
  tools = await toolRegistry.refresh().openAiTools   // namespaced serverName__toolName
  messages = [ system(SAFETY+goal), user(goalPrompt with prefs) ]
  for i in 0 .. config.openai.maxToolIterations - 1:   // HARD cap (default 6)
     completion = createChatCompletion({ messages, tools, toolChoice: tools.length? 'auto':undefined, responseFormat:{type:'json_object'} })
     msg = completion.choices[0].message            // 502 if empty
     messages.push(assistant(msg))
     if msg.tool_calls?.length:
        for each call (bounded; see below):
           result = toolExecutor.executeTool(call.function.name, call.function.arguments)  // timeout + truncation
           messages.push(tool(call.id, JSON.stringify(result)))   // on failure: push normalized {error,code} and continue
        continue
     return resultSchema.parse(extractJson(msg.content))   // final structured answer
  throw httpError(502, 'Tool loop limit reached before producing <goal>.')
```

Iteration bounding, concretely:
- **Max iterations:** `config.openai.maxToolIterations` (default 6, env-overridable). Reaching it without a final JSON answer is a *recoverable* failure that triggers degradation (3.5), not a crash.
- **Tool payload bounding:** every tool result passes through `ToolExecutor`'s truncation (`maxToolResponseChars`, default 12000) before entering `messages`, so context cannot explode.
- **Per-iteration tool-call fan-out:** cap the number of tool calls executed per assistant turn at a configurable `maxToolCallsPerIteration` (default 4) to prevent a single turn from issuing dozens of calls; extra calls beyond the cap get a normalized "skipped: per-turn tool budget exceeded" tool message so the model can proceed.
- **Timeout:** each `callTool` uses `config.mcp.requestTimeoutMs` (default 45s) as both `timeout` and `maxTotalTimeout`.

The loop's `system` prompt embeds the safety-language rules (section 6) and instructs the model that it may *only* return data sourced from tools, marking anything it could not source as `unknown` — it must not invent prices, availability, or safety claims. The `resultSchema` for discovery is `z.object({ destinations: RawCandidate[] })`; for accommodations it is `z.object({ accommodations: RawAccommodation[] })`.

### 3.5 Degradation path (openai+mcp → openai → mock)

Degradation is layered and never crashes the API process (an explicit AGENTS.md guardrail):

1. **Startup:** no OpenAI key → factory already resolves to `mock`. MCP SDK import failure is impossible at this point because MCP modules are imported lazily by the `openai+mcp` provider only.
2. **Tool discovery:** if `toolRegistry.refresh()` returns zero tools (all servers failed to connect) the `openai+mcp` provider logs the `failures` array at `warn` and *falls back within the same request* to its plain-LLM data acquisition (equivalent to the `openai` provider's `discoverCandidates`). The recommendation's `meta.provider` is stamped `'openai+mcp(degraded:no-tools)'` for diagnostics.
3. **Individual tool failure:** `ToolExecutor` throws `McpToolExecutionError`; the loop catches it, pushes a normalized `{error, code, details}` tool message, and lets the model continue with whatever other tools succeeded. Fields that depended on the failed tool are marked `unknown`.
4. **Loop exhaustion / malformed final JSON:** the provider retries acquisition once via plain LLM; if that also fails it surfaces a user-facing `httpError(502, 'Could not reach travel data providers. Showing a sample plan instead.')` — but only after attempting the mock fallback for the whole request so the user still gets a plan. The decision table:

```
openai+mcp requested
  ├─ no OpenAI key ................... use MOCK  (meta.provider='mock')
  ├─ key present, tools present ...... use MCP loop
  │     ├─ tool fails mid-loop ....... continue, mark unknowns
  │     └─ loop exhausted ............ retry via plain LLM once
  │            └─ still fails ........ fall back to MOCK data for this request
  └─ key present, no tools ........... fall back to plain LLM acquisition (degraded)
```

Every fallback is logged once at `warn`/`error` with the `failures` detail; none throws out of the process. The pure budget stages run identically regardless of which acquisition path produced the candidates, so budget authority is never weakened by degradation.

---

## 4. Nupur's deterministic evaluator (the evaluate stage)

The evaluate stage stops being an LLM ranking call and becomes **deterministic code** that implements `accommodation-evaluator.md`. The LLM's only role here is to interpret/explain results (via `agent.llm` for the `recommendation_reasons` prose), never to decide eligibility or compute scores.

### 4.1 Normalized accommodation schema (`RawAccommodation`)

Provider-agnostic internal shape all MCP providers (Airbnb/Booking/Vrbo/StayingAPI/mock) normalize into, per Nupur's "Multiple Providers" section:

```
RawAccommodation {
  listingId: string
  provider: string                 // 'stayingapi', 'mock', 'llm-estimate', ...
  name: string
  location: string | null
  checkIn: string | null           // ISO
  checkOut: string | null
  totalPriceUsd: number | null     // null => unknown, never 0-as-unknown
  nightlyPriceUsd: number | null
  currency: string = 'USD'
  roomType: 'private' | 'shared' | 'entire' | 'unknown'
  amenities: string[] = []
  rating: number | null
  reviewCount: number | null
  availability: 'available' | 'unavailable' | 'unknown'
  url: string | null
}
```

Normalization from raw MCP output lives in `src/agent/evaluator/normalizeAccommodation.js`. Missing fields become `null`/`'unknown'` — never invented, never defaulted to a favorable value.

### 4.2 Evaluation algorithm (pure, in `src/agent/evaluator/evaluate.js`)

For each candidate destination (and, when lodging matters, each `RawAccommodation`):

1. **Hard-constraint check first, before any scoring.** Hard constraints derived from normalized prefs: max budget (accommodation budget ≤ allotted share of `budgetUsd`), required dates/guests, and explicit room-type prohibitions (e.g. `shared_room: false`). Any violation → `eligible: false` with the violation recorded in `hardConstraintViolations[]`. **A hard-constraint violation is never offset by a high preference score** (Nupur's rule, enforced structurally: scoring only runs on `eligible === true` items).
2. **Preference matching** on eligible items: record `preferenceMatches` (e.g. `{ privateRoom: true, publicTransport: 'unknown' }`). Unknown data stays `'unknown'`, never silently treated as a match.
3. **Transparent, config-driven score** (only for ranking among eligible items):

```
score = w.budgetFit*budgetFitScore
      + w.preferenceMatch*preferenceMatchScore
      + w.locationFit*locationFitScore
      + w.transportationFit*transportationFitScore
      + w.interestMatch*interestMatchScore
```

Weights live in **config, not code**: `src/config/scoringWeights.json`, loaded through `env.js` (`config.scoring`), overridable per-weight by env (e.g. `SCORING_WEIGHT_BUDGET_FIT`). Default weights documented in that file. The score is explicitly **not** presented as a safety or objective-quality measure (section 6).
4. **Output** the `EvaluatedCandidate`:

```
EvaluatedCandidate {
  ...destinationFields
  eligible: boolean
  hardConstraintViolations: string[]
  preferenceMatches: Record<string, boolean | 'unknown'>
  score: number | null             // null when ineligible
  recommendationReasons: string[]  // prose, LLM-interpreted or template in mock
  concerns: string[]
  unknownFields: string[]
  source: { provider, url?, toolName? }
}
```

5. **Search-revision signal.** If zero eligible candidates remain, the evaluator returns `{ searchRevisionNeeded: true, searchRevisionReason: '<structured reason>' }` to the orchestrator (section 4.3). It **never silently relaxes a hard constraint**.

The evaluate stage returns `{ chosen, ranked, ineligible, searchRevisionNeeded, searchRevisionReason }`. `chosen` = highest-scored eligible candidate; `ranked` = eligible sorted desc by score; `ineligible` carried for UI transparency.

### 4.3 Orchestration + the max search-revision cap

`student-trip-planner.md`'s orchestration contract is implemented in `pipeline.js` as a bounded loop around discover→filter→evaluate:

```
for revision in 0 .. config.agent.maxSearchRevisions - 1:   // default 2, env SCORING-independent AGENT_MAX_SEARCH_REVISIONS
   candidates = agent.discoverCandidates(prefs, revisionHint)
   { kept } = filterByBudget(candidates, prefs)
   evaluation = evaluateDestinations(agent, kept, prefs)
   if !evaluation.searchRevisionNeeded and evaluation.chosen: break
   revisionHint = buildRevisionHint(evaluation.searchRevisionReason)  // e.g. widen neighborhoods, alt accommodation types
if no chosen after loop: throw httpError(422, '<honest reason from searchRevisionReason>')
```

The cap (`config.agent.maxSearchRevisions`, default 2) prevents infinite search loops exactly as Nupur requires. The 422 message is derived from the structured `searchRevisionReason` (e.g. "No destinations fit within your budget and distance limits"), preserving the base's existing clear failure behavior.

Constraint hierarchy from the spec is encoded in `normalize`: prefs are split into `hardConstraints`, `strongPreferences`, `softPreferences`, and `context` (university affiliation is `context` and never used to infer preferences). Hard constraints feed step 1 above; strong/soft preferences feed the scoring weights.

---

## 5. Itinerary stage — validation object, tiers, deterministic budget

`generateItinerary` is reshaped to implement `itinerary-builder.md`:

- The LLM (`agent.llm`) proposes day structure, activity names, descriptions, and *flexibility tier* per activity. It does **not** compute budget totals.
- Each activity gains `tier: 'required' | 'recommended' | 'optional'` and `source` (preserve links/provider when the activity came from a places/activities tool; `'llm-estimate'` otherwise). Required = arrival/check-in, departure/check-out, and anything satisfying a hard requirement; these are never dropped by budget trimming.
- **Deterministic budget math** is done by a pure function `src/agent/itinerary/budgetMath.js` (not the LLM), returning Nupur's budget summary:

```
budgetSummary {
  accommodation, activities, transportation, foodEstimate, total, budget, remaining
}
```

If `total > budget`: the trimming routine (pure code) removes/replaces `optional` items cheapest-impact-first, recalculates, and never touches `required` items. If it still exceeds budget after exhausting optionals, the plan is returned `withinBudget: false` with an explicit over-budget note — **never silently exceeded**.
- A **validation object** is emitted and attached to the recommendation:

```
validation {
  valid: boolean
  violations: string[]   // dates outside trip range, hard-budget breach, explicit-preference breach, missing arrival/departure
  warnings: string[]     // unknown travel times, unknown availability, mild budget stretch
}
```

`ItineraryResult` = `{ title, summary, itinerary[], validation, budgetSummary, tiers metadata }`. The pure `budgetValidation` stage (unchanged, authoritative) still recomputes `estimatedTotalUsd` from activity costs and sets `budget.withinBudget` server-side; `budgetMath`'s summary feeds the richer breakdown but `budgetValidation` remains the final word. These two layers agree because `budgetMath` uses the same per-activity `estimatedCostUsd` values; `budgetValidation` is the authority if they ever diverge.

### 5.1 Recommendation schema additions

`TripRecommendationSchema` gains (all additive, defaulted, so existing providers/tests still parse):

- `destination.evaluation?: { eligible, score, hardConstraintViolations, preferenceMatches, concerns, unknownFields }`
- `consideredDestinations[].evaluation?` (same shape) and an `ineligibleDestinations?: EvaluatedCandidate[]`
- `itinerary[].activities[].tier?` and `.source?`
- top-level `validation?: { valid, violations[], warnings[] }`
- top-level `budgetSummary?` (Nupur's shape)
- `safetyNotes?: string[]` — any uncertainty disclosures (section 6)

No existing field is made stricter; `safeParse`-level compatibility is preserved for the mock and plain-openai providers.

---

## 6. Safety-language rules (applied throughout)

A single module `src/agent/safety.js` exports the safety guardrails as (a) prompt text injected into every LLM/tool-loop system prompt and (b) a pure post-processor `applySafetyLanguage(recommendation)` that runs before the final `.parse`.

Rules enforced:
- Never claim an area/listing/host/activity is objectively "safe" or "unsafe" without reliable data. The evaluator maps a user safety preference (e.g. "avoid isolated areas") against available data and, when data is missing, emits `"Location could not be evaluated against this preference with the available data."` into `concerns`/`safetyNotes` rather than a verdict.
- Honest unknowns: `unknown` is never coerced to "acceptable". The post-processor scans for banned phrasings ("completely safe", "definitely safe", "nothing to worry about", "guaranteed") and, if a model slips one in, replaces the sentence with a factual uncertainty disclosure and logs a warning.
- The transparent score is never labeled as a safety or quality rating in any user-facing string.

This is deterministic and testable (feed a recommendation containing a banned phrase; assert it is rewritten and a `safetyNotes` entry is added).

---

## 7. Frontend merge plan

### 7.1 Base kept as skeleton

The base TypeScript `PlanWizard` (`src/planner/*` with steps Budget/Dates/Travelers/Interests/Accommodation/Transportation/TravelStyle/Review and the shared components), the `src/pages/*` routing, the results components under `src/results/*`, and the accessibility system (`src/context/AccessibilityContext.jsx` + `src/components/AccessibilityToolbar.jsx`, with colorblind themes / text-size / high-contrast) are all **kept**. The accessibility toolbar stays mounted on every page.

### 7.2 Wire the frontend to the backend recommendations endpoint

Today `useRecommendation` calls a client-side `MockTravelAgent`. We replace the agent factory's default with an **`HttpTravelAgent`** that POSTs to `/api/recommendations` (and optionally `/api/recommendations/stream` for progressive stage updates feeding the existing `AnalyzingState`). The mock agent is retained behind an env/flag so the UI still runs with the backend down.

A new mapping module `src/agent/toBackendPreferences.ts` converts the wizard's rich `TripPreferences` into the backend `PreferencesInputSchema` body:

```
budgetUsd         <- budget.tripBudgetUsd            (required; guard null → validation error in Review)
tripLengthDays    <- dates.lengthDays | derived from startDate/endDate
interests         <- interests.map(interestLabel)    (custom: prefix stripped)
departureCity     <- 'Minneapolis' (UMN default; a field may be added later)
travelPace        <- pace slider → 'relaxed'|'balanced'|'packed'
tripStyle         <- travelStyle → 'budget'|'moderate'|'comfort'
maxTravelDistanceKm <- derived from comfort/transportation when present, else omitted
notes             <- assembled from adventureVsRelaxation + accommodation + transportation + travelers
```

A second module `src/agent/fromBackendRecommendation.ts` maps the backend `TripRecommendation` into the frontend `recommendationTypes.ts` shapes the results components already consume (destination, budget categories with precomputed percents, itinerary days grouped into morning/afternoon/evening blocks, reasons, alternatives). This keeps all existing results components unchanged. The backend's new `validation`, `evaluation`, `tier`, and `safetyNotes` fields are surfaced in the UI (sections 7.3–7.4).

Error handling: a non-2xx response or network failure sets the hook's `status: 'error'` with the backend's `error` message (already structured by `errorHandler.js`); the existing error UI with "Try again" is reused. Rate-limit (429) shows the backend message verbatim.

### 7.3 Verayn's editable accessible itinerary

Adopt Verayn's App.jsx itinerary editor as a new results component `src/results/components/EditableItinerary.tsx`, layered over (or replacing) the read-only `ItineraryTimeline` on the results page:

- Adjustment toggles — **lower walking / more rest / quieter evenings / dietary planning** — as a keyboard-accessible `fieldset` of checkboxes. Toggling re-derives day copy locally (Verayn's `buildItinerary` adjustment logic), and because the backend now returns `tier`, toggles only ever rewrite `optional`/`recommended` day text, never `required` arrival/departure items.
- An `aria-live="polite"` region announces saves/resets ("Saved edits for Day 2 afternoon.", "Reset all days.") — ported from Verayn's `editorNotice` pattern.
- Per-day and whole-itinerary reset buttons.

Edits are client-side only (the itinerary is already generated); no new backend call is needed for an adjustment unless the user hits "Regenerate" (existing `ModifyControls`).

### 7.4 Verayn's scored recommendation / boarding-pass cards

Adopt Verayn's "boarding pass" best-fit card and secondary recommendation cards as `src/results/components/BoardingPassCard.tsx` and feed them from the backend's `evaluation` data: show budget fit, trip length fit, safety handling (as a *factual* statement, honoring section 6 — e.g. "Safety preference: balanced; evaluated against available data"), comfort/goals/activities matches, estimated total, and the `recommendationReasons`. The scored secondary cards map to `consideredDestinations` with their `evaluation.score`. Ineligible destinations, if shown, display their `hardConstraintViolations` plainly rather than a score.

### 7.5 Design language

Copy `TravelAgent Verayn Version/travel-agent-ui/frontend_design.md` into the merged `frontend/frontend_design.md` and adopt it as the project's design direction (avoid templated/generic AI aesthetics; one bold hero element; deliberate type scale; motion only on user action — which aligns with the accessibility reduced-motion requirement). The existing `src/styles/*` are refined toward it, keeping GopherTrip + UMN gopher framing. This is a direction doc, not code; it governs CSS choices in the results/planner styles.

### 7.6 Accessibility preservation (non-negotiable)

Visible focus styles, full keyboard navigability, colorblind/high-contrast/text-size controls, and `aria-live` result updates are preserved. The new editable itinerary and boarding-pass cards must pass the same bar: labelled controls, `fieldset`/`legend`, non-color-only state, decorative icons `aria-hidden`. Reduced-motion is respected (Verayn's and the base's motion is CSS-gated).

---

## 8. AGENTS.md and README

### 8.1 Root AGENTS.md

Adopt Bear's `AGENTS.md` as a **project-wide `AGENTS.md` at the merged repo root**, updated to describe the unified architecture. It carries forward verbatim the guardrails that still hold: thin controllers / logic in services & stages, preserve accessibility behavior, preserve mock fallback, no hardcoded secrets, MCP namespacing `serverName__toolName`, bounded tool payloads, ES modules, graceful degradation, and the verification discipline (read first, smallest surface, run relevant checks, report what changed/tested/gaps). It is extended with: the three-provider model (`mock | openai | openai+mcp`), the deterministic-evaluator and deterministic-budget rules (budget math never delegated to the LLM; hard constraints never offset by score), the config-driven scoring weights location, the safety-language rules, and the search-revision cap. The repo map is updated to the merged layout (`backend/src/agent/{evaluator,itinerary,mcp}`, `backend/src/config/{mcpServers,scoringWeights}.json`, frontend `results/components/{EditableItinerary,BoardingPassCard}`). The required-verification section switches the smoke-test endpoint to `POST /api/recommendations` (and `/stream`) while keeping `npm run test:mcp`.

### 8.2 Root README

Update the merged root `README.md` to describe the unified GopherTrip: the GopherTrip + UMN-student framing, accessibility as a first-class feature, the staged provider-agnostic pipeline, the MCP integration and provider selection (`TRAVEL_AGENT_PROVIDER=auto|mock|openai|openai+mcp`), the deterministic evaluator + budget authority, how to run backend and frontend, and the environment variables (pointing at `backend/.env.example`). It must not include any secret values.

---

## 9. Edge cases

- **No OpenAI key:** everything resolves to `mock`; full pipeline + frontend work end-to-end (preserved base behavior).
- **MCP manifest has only disabled servers:** `'auto'` picks `openai`; `openai+mcp` explicitly requested degrades to plain-LLM acquisition.
- **StayingAPI returns zero listings for a destination:** evaluator marks accommodation data `unknown`; if a *hard* lodging constraint exists and no eligible listing is found, that destination becomes ineligible and the search-revision loop tries alternatives up to the cap.
- **MCP tool returns a huge payload:** truncated to `maxToolResponseChars`; `truncated: true` is carried so the model/UI knows data was clipped.
- **Model emits a banned safety phrase:** `applySafetyLanguage` rewrites it and records a `safetyNotes` entry.
- **Budget cannot be met even after dropping all optionals:** returned `withinBudget: false` with an explicit note; never silently exceeded; never silently relaxes a hard constraint.
- **Trip length derivable only from exact dates:** mapping computes `tripLengthDays` from `startDate`/`endDate`; if neither length nor valid dates exist, the Review step blocks submission with an inline message.
- **Client disconnects mid-SSE:** existing controller `clientGone` guard stops writes; tool loop still completes or is abandoned without crashing.
- **Rate limit hit:** 429 with the base limiter's message, shown verbatim in the UI.
- **MCP SDK import failure / server process missing (stdio path):** connection error normalized to `McpConnectionError`; counted as a tool-discovery failure → degradation, process stays up.

---

## 10. Verification plan

**Backend unit tests** (add a test runner — use Node's built-in `node:test` + `assert`, no new heavy dep; add `"test": "node --test"` to `backend/package.json`):
- `normalize`: constraint-hierarchy split; server-derived `dailyBudgetUsd`; interest dedupe/fallback.
- `budgetFilter` / `budgetValidation`: ceiling + distance filtering; authoritative total recompute; over-budget flagged not hidden.
- `evaluate` (deterministic): hard-constraint violation forces `eligible:false` and is **not** offset by a high preference score; unknown fields stay `unknown`; score uses config weights (swap weights → ranking changes); zero-eligible → `searchRevisionNeeded`.
- `budgetMath` + trimming: optional-first trimming, required items retained, never-silently-over-budget.
- `safety.applySafetyLanguage`: banned phrase rewritten, `safetyNotes` populated.
- Orchestration: search-revision loop stops at `maxSearchRevisions`; 422 reason derived from structured signal.
- Degradation: with a stubbed registry returning zero tools, `openai+mcp` falls back without throwing; mock path always returns a schema-valid recommendation.

**Backend integration / smoke** (per AGENTS.md):
- `npm run test:mcp` — exercises `McpClientManager`/`ToolRegistry`/`ToolExecutor` against the in-process mock stdio MCP server; assert `ok:true`, namespaced tool names, truncation respected.
- `POST /api/recommendations` success (mock provider) → schema-valid `recommendation`; validation-failure path → 400 with field errors; `/stream` emits `stage` events then `result`.

**Frontend:**
- `npm run build` (type-check + Vite build) must pass with the new mapping modules and components.
- Mapping round-trip unit tests (`toBackendPreferences`/`fromBackendRecommendation`) with `vitest` if present, else a small `node:test` over compiled output; assert null-budget guard and itinerary block grouping.
- Manual accessibility checks: wizard submits, results render, editable-itinerary toggles announce via `aria-live`, boarding-pass cards keyboard-reachable, colorblind/high-contrast/text-size controls still work, reduced-motion honored. (Full WCAG conformance requires manual assistive-tech testing and expert review beyond this plan.)

**What cannot be fully verified here:** live StayingAPI/remote MCP behavior (no credentials in the repo; covered only by the mock stdio server and manual testing with a real token), and real OpenAI tool-calling quality (covered structurally by the mock, not semantically). These are called out as gaps per the verification guideline.

Temporary files/servers created during verification (mock MCP stdio process) are shut down by `testMcpConnection.js`'s `finally` block.

---

## 11. Testability summary

- **Unit-testable (pure, deterministic):** normalize, budgetFilter, budgetValidation, the Nupur evaluator, budgetMath + trimming, safety post-processor, orchestration cap, both frontend mapping modules. These carry the domain rules and are the core of the merge, so the design deliberately keeps them pure and injectable.
- **Integration-testable:** MCP layer via the mock stdio server (`test:mcp`); `/api/recommendations` endpoints with the mock provider; frontend build.
- **Hard to test automatically (manual/stubbed):** live remote MCP servers and real LLM tool-calling semantics. The capability-object design makes the mock a structural stand-in so control flow (loop bounding, degradation, hand-off schemas) is still exercised without a key or network.
