# GopherTrip Backend

Node + Express API that holds all the core logic. It turns a student's structured travel
preferences into a personalized trip recommendation using a multi-stage AI travel-agent
pipeline backed by the OpenAI API.

## Setup

```bash
npm install
cp .env.example .env   # add your OPENAI_API_KEY (optional — mock works without it)
npm run dev            # starts on http://localhost:3001 with auto-reload
```

If no `OPENAI_API_KEY` is set, the API transparently uses a deterministic **mock**
provider that runs the full pipeline with sample data, so the frontend can be developed
without a key. The response's `meta.provider` tells you which provider answered — but the
UI does not need to branch on it.

## The agent architecture

Generation is **not** a single "plan me a trip" prompt. It's a structured pipeline where
each stage has one job, and the budget/validation stages are plain server-side code (not
the model) so hard constraints are enforced, not merely requested:

```
validated preferences
      ↓  normalize            (pure)  derive canonical prefs + per-day budget
      ↓  destination discovery (LLM)  brainstorm candidate destinations
      ↓  budget filtering     (pure)  drop unaffordable / too-far candidates
      ↓  destination evaluation(LLM)  rank + pick the best fit, with reasoning
      ↓  itinerary generation (LLM)   day-by-day plan, realistic travel times
      ↓  budget validation    (pure)  recompute totals, set withinBudget
      → final TripRecommendation
```

The model is instructed to stay within budget, respect trip duration, consider travel
distance, prioritize interests, avoid impossible itineraries, avoid scheduling activities
too far apart, include realistic travel time, explain why destinations fit, provide
estimated costs, and mark every price as an estimate (see `src/agent/constraints.js`).

### Provider abstraction

`TravelAgentProvider` defines `generateTrip(preferences)` and
`generateTripStream(preferences, onStage)`. Both the `mock` and `openai` providers drive
the *same* pipeline and differ only in the per-stage LLM step they inject. Swapping or
adding a provider (Anthropic, a local model, ...) means editing only
`src/providers/index.js` — the controller, routes, and frontend are untouched.

## Endpoints

### `GET /api/health`
Health check. Returns `{ status: "ok" }`.

### `POST /api/recommendations`
Generate a recommendation (non-streaming JSON). Body is validated server-side with Zod.

Request body:

```json
{
  "budgetUsd": 3000,
  "tripLengthDays": 3,
  "interests": ["hiking", "food", "museums"],
  "departureCity": "Minneapolis",
  "maxTravelDistanceKm": 2000,
  "travelPace": "balanced",
  "tripStyle": "moderate",
  "notes": "optional free text"
}
```

Response: `{ "recommendation": TripRecommendation }` — see
`src/schemas/recommendation.schema.js` for the full shape (destination + reasoning,
considered alternatives, day-by-day itinerary with travel times and per-activity costs, a
structured budget breakdown with `withinBudget`, and a disclaimer that prices are
estimates). Retry and regenerate are simply repeat POSTs.

### `POST /api/recommendations/stream`
Same input and validation, but streams progress as **Server-Sent Events** for progressive
generation. Events:

- `stage` — `{ stage, status: "start"|"done", detail? }` for each pipeline stage
- `result` — `{ recommendation }` once complete
- `done` — `{ ok: true }`
- `error` — `{ error, details? }` if generation fails (client can show an error + retry)

### `POST /api/trips` (legacy)
The original single-shot endpoint, kept so the in-progress frontend keeps working. New
work should target `/api/recommendations`.

## Security

- **Server-side validation (Zod).** Every field is validated and sanitized at the trust
  boundary (`middleware/validate.js` + `schemas/preferences.schema.js`). Unknown keys are
  stripped.
- **Client values are never trusted.** Per-day budget is derived server-side, and the
  final budget total is recomputed from actual activity costs in the budget-validation
  stage — the client's budget is only ever used as a ceiling to check against.
- **Secrets stay server-side.** The OpenAI key is read from env and used only by the
  server-side client. It is never sent to or referenced by the frontend.
- **Rate limiting.** The generation endpoints are rate-limited per IP
  (`RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX`).

## Structure

```
src/
├── server.js                      App entry
├── app.js                         Express app factory
├── config/
│   └── env.js                     Env config + provider resolution
├── schemas/
│   ├── preferences.schema.js      Input + normalized preferences (Zod)
│   └── recommendation.schema.js   TripRecommendation output contract (Zod)
├── providers/
│   ├── TravelAgentProvider.js     Abstract provider contract
│   ├── MockTravelAgentProvider.js Deterministic, no-key provider
│   ├── OpenAITravelAgentProvider.js  Real LLM provider (JSON mode + retry)
│   └── index.js                   Provider factory (the only swap point)
├── agent/
│   ├── constraints.js             The agent's hard rules + prompt helpers
│   ├── pipeline.js                Runs the 6 stages, emits progress
│   └── stages/
│       ├── normalize.js           (pure)
│       ├── discovery.js           (LLM)
│       ├── budgetFilter.js        (pure)
│       ├── evaluation.js          (LLM)
│       ├── itinerary.js           (LLM)
│       └── budgetValidation.js    (pure, authoritative)
├── routes/
│   ├── index.js                   Mounts routers under /api
│   ├── health.routes.js
│   ├── trips.routes.js            Legacy endpoint
│   └── recommendations.routes.js  New agent endpoint (+ /stream)
├── controllers/
│   ├── trips.controller.js        Legacy
│   └── recommendations.controller.js  JSON + SSE
├── services/
│   ├── openai.client.js           Server-side OpenAI client
│   └── trip.service.js            Legacy trip logic
└── middleware/
    ├── errorHandler.js            Central error handling
    ├── validate.js                Zod body validation
    └── rateLimit.js               Generation rate limiter
```

## Frontend integration notes

For progressive UX, call `POST /api/recommendations/stream` with an `EventSource`-style
reader and render each `stage` event as a step indicator; swap to the final itinerary on
`result`. For a simpler integration, call `POST /api/recommendations` and show a spinner
until the JSON resolves. In both cases:

- **Loading**: request in flight.
- **Error**: non-2xx response (or `error` SSE event) carries `{ error, details? }`.
- **Retry / Regenerate**: just re-issue the same POST.
