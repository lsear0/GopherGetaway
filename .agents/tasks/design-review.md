# Design Review — GopherTrip Unified Merge

Reviewed: `.agents/tasks/design.md`
Scope: the four-version merge into `.worktrees/merge-unified/` (base pipeline + Bear MCP + Nupur rulebook + Verayn UX).
Method: read the design cold, then verified every structural claim against the actual source in the worktree and the four read-only reference folders.

Verdict: **CHANGES_REQUESTED** (2 HIGH, 6 MEDIUM, 5 NIT).

The design is strong on the highest-risk spine (data contracts, loop bounding, degradation table, deterministic budget/scoring, safety rules) — those are specified concretely and match the source and the Nupur specs. The blocking issues are all in the connective tissue the design under-specifies: an `httpError` signature contradiction it introduces itself, and the frontend wiring (the `applyModifier` path and several lossy enum mappings).

---

## Findings

### 1. [HIGH] `httpError` signature contradiction between "keep its signature" and Bear's `createChatCompletion` dependency

Section 2.2 says the merged `errorHandler.js` keeps the base's `httpError` and to "keep its signature." The base signature is `httpError(status, publicMessage)` — exactly two args, and it sets only `err.status`/`err.publicMessage` (verified in `backend/src/middleware/errorHandler.js`). But section 2.2 also imports Bear's `services/openai.client.js` **unchanged in behavior**, and Bear's `createChatCompletion` calls `httpError(502, '...', { status, message, code })` with a **third argument** (verified in `TravelAgent Bear Version/.../openai.client.js`). With the base's two-arg `httpError`, that third argument is silently dropped, so MCP/OpenAI error `details` never reach the client. Worse, the base `errorHandler` only surfaces `body.details` when `Array.isArray(err.details)`, while Bear passes a plain object — so even if the signature were widened, the detail shape wouldn't surface. The design cannot simultaneously "keep the base signature" and run Bear's client unchanged.

Fix: pick one explicitly. Recommended — widen the merged helper and the handler:
```js
export function httpError(status, publicMessage, details) {
  const err = new Error(publicMessage);
  err.status = status;
  err.publicMessage = publicMessage;
  if (details !== undefined) err.details = details;
  return err;
}
// errorHandler: surface object OR array details
if (err.details !== undefined) body.details = err.details;
```
Then state in the design that `httpError` gains an optional third `details` arg (object or array) and that the handler surfaces both, so Bear's client, the tool loop, and the base validation path all behave consistently.

### 2. [HIGH] `HttpTravelAgent.applyModifier` is unspecified, but the results flow depends on it

Section 7.2 specifies an `HttpTravelAgent` that POSTs to `/api/recommendations` for `generateTrip`. But the frontend `TravelAgent` interface (verified in `frontend/src/agent/TravelAgent.ts`) requires **two** methods: `generateTrip` and `applyModifier`. `useRecommendation.ts` (verified) calls `agent.applyModifier(prefs, current, modifier)` for both "regenerate" and every `ModifyControls` modifier (cheaper, more adventurous, …). The design never says how `HttpTravelAgent.applyModifier` maps to the backend. Section 7.3 says itinerary toggles are client-side only, and the edge-case list says "unless the user hits Regenerate (existing `ModifyControls`)" — implying a backend call — but the request body for a modifier is undefined (the backend `PreferencesInputSchema` has no "modifier" or "prior recommendation" field; verified). Without this, the results page cannot compile against the interface or will throw at runtime on regenerate.

Fix: specify `applyModifier` concretely. Simplest correct option: translate each modifier into a preferences delta and re-POST `/api/recommendations` with the adjusted body (e.g. `cheaper` → scale `budgetUsd` down 15%; `more-adventurous` → append a note / adjust `tripStyle`), discarding `current`. State the exact mapping per `TripModifier` value, and confirm no backend schema change is needed (or add one additive field if you want prior-plan context). Alternatively, declare `applyModifier` just calls `generateTrip` with the same prefs for `regenerate` — but then the non-regenerate modifiers must still be defined.

### 3. [MEDIUM] `travelStyle` (4 values) → backend `tripStyle` (3 values) mapping is undefined

Section 7.2 maps `tripStyle <- travelStyle → 'budget'|'moderate'|'comfort'`. The frontend `TravelStyle` is `'backpacker' | 'balanced' | 'comfort' | 'luxury'` (4 values; verified in `planner/types.ts`), and the backend enum is `['budget','moderate','comfort']` (verified in `preferences.schema.js`). Four-into-three is lossy and unspecified: where do `backpacker` and `luxury` land?

Fix: give the explicit table, e.g. `backpacker→budget`, `balanced→moderate`, `comfort→comfort`, `luxury→comfort`. Put it in the design so the implementer doesn't guess.

### 4. [MEDIUM] `pace` slider (1–5) → backend `travelPace` (3 values) mapping is undefined

Section 7.2 maps `travelPace <- pace slider → 'relaxed'|'balanced'|'packed'`. The frontend `pace` is `SliderValue` 1–5 where "1 = packed … 5 = relaxed" (verified in `planner/types.ts`); the backend enum is `['relaxed','balanced','packed']` (verified). Collapsing 5 steps into 3 buckets is unspecified (where do 2 and 4 go?), and the direction is inverted (1=packed), which is easy to get backwards.

Fix: specify, e.g. `1–2 → 'packed'`, `3 → 'balanced'`, `4–5 → 'relaxed'`. Call out the inverted scale explicitly.

### 5. [MEDIUM] `interests` "custom: prefix stripped" assumes an encoding the source doesn't define

Section 7.2 says `interests <- interests.map(interestLabel) (custom: prefix stripped)`. `TripPreferences.interests` is `string[]` holding "selected interest ids (from INTEREST_OPTIONS) plus any custom free-text interests" (verified in `types.ts`). There is no documented prefix convention for custom entries in `types.ts`, and `INTEREST_OPTIONS` ids are bare (`'nature'`, not `'id:nature'`). The design's "prefix stripped" implies a convention that must exist in `InterestsStep.tsx`. This was not verified against `InterestsStep.tsx`, so the rule may be describing something that isn't there.

Fix: before implementation, read `planner/steps/InterestsStep.tsx` to confirm how custom interests are stored. Then state the mapping precisely: for ids present in `INTEREST_OPTIONS`, send the `label`; for custom entries, send the raw string (and define exactly what "prefix" means, or drop that clause if there is none).

### 6. [MEDIUM] Section 7.4 adopts Verayn's boarding-pass card but doesn't reconcile its numeric "Safety score X/5" with the section 6 safety rule

Verayn's `App.jsx` boarding-pass card renders a numeric **"Safety score {safety}/5"** driven by hardcoded per-destination `safety` ratings and `safetyThresholds` (verified in `TravelAgent Verayn Version/.../App.jsx`). Section 6 forbids presenting any objective safety/quality rating without reliable data, and section 7.4 says to show safety "as a factual statement … e.g. 'Safety preference: balanced; evaluated against available data'." These conflict: a literal adoption of Verayn's card would ship exactly the banned numeric safety rating. The design says to feed the card from backend `evaluation` data but never explicitly says to **remove** the `safety X/5` metric and the `score`-as-safety framing.

Fix: state explicitly that `BoardingPassCard` drops Verayn's numeric safety score and the `safetyThresholds` logic, replacing it with a factual safety-preference statement sourced from `evaluation.preferenceMatches`/`concerns`, and that the transparent `evaluation.score` is labeled a "fit score," never a safety/quality rating (consistent with section 6's last bullet).

### 7. [MEDIUM] Per-iteration tool-call fan-out cap conflicts with Bear's `Promise.all` execution model as written

Section 3.4 adds a new `maxToolCallsPerIteration` (default 4) and says extra calls "get a normalized 'skipped' tool message so the model can proceed." Bear's actual loop executes all `message.tool_calls` in parallel via `Promise.all` and pushes one tool message per call (verified in `trip.service.js`). The design's pseudocode shows a sequential "for each call (bounded)" loop, which is a different control structure than the code it claims to adapt. The important correctness detail — **every** `tool_call_id` in an assistant turn must get a matching `tool` message or the next OpenAI request errors — isn't stated for the skipped calls.

Fix: specify that for calls beyond the cap, the loop still pushes a `tool` message with the same `tool_call_id` carrying `{ error: 'skipped: per-turn tool budget exceeded', code: 'TOOL_BUDGET_EXCEEDED' }` (so the API's tool_call/tool pairing invariant holds), and decide explicitly whether the first N run via `Promise.all` or sequentially.

### 8. [MEDIUM] "auto → openai+mcp" selection changes default behavior for existing deployments without noting the risk

Section 3.2 makes `'auto'` resolve to `openai+mcp` whenever any MCP server is enabled in the manifest. The copied-in `mcpServers.json` has `stayingapi` **enabled** by default (section 2.1). So any current deployment that sets no `TRAVEL_AGENT_PROVIDER` and has a key will silently switch from today's plain `openai` to the MCP tool-loop path — a materially different, slower, external-dependency path — on upgrade. The degradation path keeps it from crashing, but the behavior change on `auto` is a surprise that isn't flagged.

Fix: either default `stayingapi` to disabled in the merged manifest (so `auto` stays `openai` until an operator opts in), or explicitly document in the design + README that upgrading flips `auto` to `openai+mcp` and how to pin back (`TRAVEL_AGENT_PROVIDER=openai`).

### 9. [NIT] `env.js` doc comment and `resolveProviderName` JSDoc still say `'mock' | 'openai'`

The base `env.js` comments and `resolveProviderName`'s `@returns {'mock' | 'openai'}` (verified) will be stale once the third provider is added. The design mentions extending the function but not updating the surrounding docs/`providers/index.js` switch comment (`// 'mock' | 'openai'`).

Fix: note that the JSDoc, the inline provider comment, and `providers/index.js`'s `resolveProviderName()` comment are updated to the three-value union.

### 10. [NIT] `departureCity <- 'Minneapolis'` mapping is redundant

Section 7.2 maps `departureCity <- 'Minneapolis' (UMN default)`. `PreferencesInputSchema.departureCity` already defaults to `'Minneapolis'` server-side (verified). Sending it from the client is harmless but redundant and risks drift if the server default changes.

Fix: omit `departureCity` from the client body and let the server default apply, or note the duplication is intentional.

### 11. [NIT] Mock provider stage detection relies on regex over system-prompt phrases that the reshape may rename

The current mock detects stages via `/destination-discovery/`, `/destination-evaluation/`, `/itinerary-generation/` on the system prompt (verified in `MockTravelAgentProvider.js`). The reshape (section 3.1) replaces the single `llm` with `discoverCandidates`/`fetchAccommodations` capability methods, which is cleaner, but the design doesn't explicitly say the mock stops using prompt-regex detection and instead implements the capability methods directly.

Fix: state that `MockTravelAgentProvider` is rewritten to implement `discoverCandidates`/`fetchAccommodations`/`llm` directly (no prompt sniffing), returning `RawCandidate[]`/`RawAccommodation[]` shaped data.

### 12. [NIT] `budgetValidation` vs `budgetMath` dual-authority needs a single explicit reconciliation rule in code

Section 5 says `budgetValidation` stays authoritative and `budgetMath` feeds the richer breakdown, "and these two layers agree because `budgetMath` uses the same per-activity `estimatedCostUsd` values." That's an assumption, not an enforced invariant — `budgetMath` also adds `foodEstimate`/`transportation` categories the current `budgetValidation` recompute (sum of activity `estimatedCostUsd`) does not include (verified `budget` shape in `recommendation.schema.js` has no food/transport split). They can legitimately diverge.

Fix: state which total is shown where (e.g. `budgetSummary.total` is display-only; `budget.estimatedTotalUsd` from `budgetValidation` is the authority and the `withinBudget` source of truth) and that any divergence is expected because `budgetSummary` includes categories outside the activity sum.

### 13. [NIT] Verification plan adds `node --test` but doesn't note the base backend currently has no test script

Section 10 adds `"test": "node --test"`. Confirmed the base `backend/package.json` is the integration point; the design should note whether any `*.test.js` convention/location is established (e.g. `src/**/*.test.js` vs a `test/` dir) so `node --test`'s discovery actually finds them.

Fix: specify the test file location/glob `node --test` will use.

---

## Verified Assumptions (checked against source)

- **Bear's MCP files exist and can be copied verbatim.** `src/mcp/{McpClientManager,ToolRegistry,ToolExecutor}.js`, `src/config/mcpServers.json`, and `scripts/{testMcpConnection,mockMcpServer}.js` all exist under `TravelAgent Bear Version/TravelAgent/backend/`. (Initial depth-limited listing hid `src/mcp/`; a full recursive listing confirmed them.)
- **Bear's `env.js` fields the design merges all exist**: `openai.maxToolIterations` (default 6, `OPENAI_MAX_TOOL_ITERATIONS`), the full `mcp` block, `getMcpServerOverride`, `readPositiveInteger`, `readOptionalUrl`, `readOptionalJsonArray`, `sanitizeServerName`, and the three API-key passthroughs. Verified.
- **Bear's `createChatCompletion({ messages, tools, toolChoice, responseFormat })` exists** and maps SDK errors to `httpError(502, …)`; `getOpenAIClient()` returns `null` with no key. Verified.
- **Bear's tool loop is bounded by `config.openai.maxToolIterations`** and throws `httpError(502, …)` on exhaustion; tool failures are normalized to `McpToolExecutionError` and pushed as tool messages so the loop continues. Verified — matches section 3.4's spine.
- **Base pipeline stage sequence** `normalize → discovery → budgetFilter → evaluation → itinerary → budgetValidation`, with budget stages pure and an injected `llm`, and a final `TripRecommendationSchema.parse`. Verified in `pipeline.js`.
- **Both providers drive the same `runPipeline` and differ only in injected `llm`.** Verified in `MockTravelAgentProvider.js` / `OpenAITravelAgentProvider.js`.
- **Zod `.object()` strips unknown keys**, so secrets have no field to ride out on in the final recommendation. Verified (schemas use default object mode; `PreferencesInputSchema` uses `.strip()`).
- **Nupur's rules the design encodes are faithful to the specs**: hard constraints checked before scoring and never offset by score; config-driven transparent score never labeled safety/quality; honest unknowns never coerced to acceptable; provider-agnostic normalized accommodation schema; structured search-revision reason; "never silently relax a hard constraint"; mandatory max search/revision cap. All present in `accommodation-evaluator.md` and `student-trip-planner.md`.
- **Base controller SSE has a `clientGone` guard** on `req.on('close')` that stops writes. Verified — section 9's "client disconnects mid-SSE" claim holds.
- **Frontend `getTravelAgent()` is the single factory** returning `MockTravelAgent`, so swapping in `HttpTravelAgent` is a one-line change. Verified in `frontend/src/agent/index.ts`.
- **Verayn's App.jsx has the editable itinerary with `aria-live="polite"` editor notices, per-day + whole-itinerary reset, and the four adjustment toggles** (lower walking / more rest / quieter evenings / dietary planning) in a `fieldset`. Verified — sections 7.3 claims are accurate.
- **`PreferencesInputSchema` is additive-friendly** (`.strip()`, `.extend()` for normalized) and has `budgetUsd`, `tripLengthDays`, `interests`, `departureCity` (default 'Minneapolis'), `maxTravelDistanceKm`, `travelPace`, `tripStyle`, `notes`. Verified.

## Unverified / Wrong Assumptions

- **WRONG — "keep its [`httpError`] signature" while reusing Bear's client.** The base `httpError` is two-arg and sets no `details`; Bear's `createChatCompletion` passes a third object arg. The two cannot coexist unchanged. (Finding 1.)
- **WRONG — "the `HttpError` base used by both."** The base `errorHandler.js` exports a `httpError` *factory function* and a plain `Error`; there is no `HttpError` *class* in the base to extend. Bear's `McpConnectionError`/`McpToolExecutionError` subclasses need an `HttpError` base that must be *created*, not "kept." The design presents it as pre-existing. (Related to finding 1 — the design should say it introduces the `HttpError` class.)
- **UNVERIFIED — custom-interest "prefix" encoding.** `InterestsStep.tsx` was not read; the "custom: prefix stripped" rule may not correspond to any actual storage convention. (Finding 5.)
- **UNVERIFIED — `travelStyle`/`pace` collapse rules.** The source enums were verified; the design's lossy many-to-fewer mappings are undefined, so the intended behavior could not be confirmed. (Findings 3, 4.)
- **UNVERIFIED (semantic) — live StayingAPI / remote MCP behavior and real OpenAI tool-calling quality.** No credentials in the repo; only the in-process mock stdio server exercises the MCP layer. The design itself calls this out in section 10 as a known gap — acknowledged, not a finding.
- **UNVERIFIED — `budgetMath`/`budgetValidation` agreement.** Asserted, not enforced; the two compute over different category sets. (Finding 12.)

---

## Verdict rationale (mechanical)

HIGH = 2, MEDIUM = 6 → non-zero → **CHANGES_REQUESTED**. Resolve findings 1–8 (at minimum the two HIGHs and the frontend-mapping MEDIUMs) and the design is ready for implementation; the spine of the merge (contracts, loop bounding, degradation, deterministic budget/scoring, safety) is sound and well-matched to the source.
