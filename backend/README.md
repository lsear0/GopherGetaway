# GopherTrip Backend

Node + Express API that holds all the core logic. It takes a student travel profile and uses
the OpenAI API to generate a personalized trip itinerary.

## Setup

```bash
npm install
cp .env.example .env   # add your OPENAI_API_KEY
npm run dev            # starts on http://localhost:3001 with auto-reload
```

If `OPENAI_API_KEY` is not set, the API returns a clearly-labeled **mock** itinerary so the
frontend can be developed without a key.

## Endpoints

### `GET /api/health`

Health check. Returns `{ status: "ok" }`.

### `POST /api/trips`

Generate a trip from a student profile.

Request body:

```json
{
  "income": 20000,
  "interests": ["hiking", "museums", "food"],
  "tripLengthDays": 5,
  "departureCity": "Minneapolis",
  "notes": "Prefer budget-friendly options near campus breaks."
}
```

Response:

```json
{
  "trip": {
    "title": "...",
    "summary": "...",
    "estimatedBudgetUsd": 1200,
    "days": [{ "day": 1, "title": "...", "activities": ["..."] }]
  },
  "source": "openai" // or "mock"
}
```

## Structure

```
src/
├── server.js                  App entry — wires middleware + routes
├── app.js                     Express app factory
├── config/
│   └── env.js                 Loads and validates environment config
├── routes/
│   ├── index.js               Mounts all routers under /api
│   ├── health.routes.js
│   └── trips.routes.js
├── controllers/
│   └── trips.controller.js    Validates input, calls the service
├── services/
│   ├── openai.client.js       Creates the OpenAI client
│   └── trip.service.js        Builds the prompt + core trip logic
└── middleware/
    └── errorHandler.js        Central error handling
```
