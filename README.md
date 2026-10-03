# GopherGetaway — AI Travel Agent for UMN Students

A website where University of Minnesota students enter their budget, interests, and travel
preferences, and an AI travel agent builds a personalized, budget-honest trip for them.

This project is the **unified merge** of four sibling versions. It keeps the staged,
provider-agnostic pipeline as the backbone and layers in each contributor's strongest ideas:

- **Base pipeline** — a six-stage agent (`normalize → discover → budgetFilter → evaluate →
  itinerary → budgetValidation`) behind a `TravelAgentProvider` factory, with Zod schemas at
  every trust boundary. The two budget stages are pure code and stay authoritative.
- **Bear — MCP integration** — a Model Context Protocol layer (`McpClientManager`,
  `ToolRegistry`, `ToolExecutor`) plus an autonomous OpenAI tool-calling loop, exposed as a
  third provider (`openai+mcp`) that can feed discovery/evaluation with real external travel
  data. It degrades gracefully to plain LLM, then mock, and never crashes the process.
- **Nupur — deterministic domain logic** — the evaluate stage is deterministic code
  (hard-constraint checks before scoring, transparent config-driven weights, honest
  `unknown` handling), the itinerary stage emits a validation object and required/
  recommended/optional tiers with deterministic budget math, orchestration enforces a
  max search-revision cap, and safety-language rules are applied throughout.
- **Verayn — frontend polish** — scored "boarding pass" recommendation cards and an editable
  accessible itinerary with adjustment toggles (lower walking / more rest / quieter evenings
  / dietary planning) and an `aria-live` save announcement, layered onto the existing
  TypeScript `PlanWizard` and the accessibility system.

Accessibility is a first-class feature: colorblind-friendly palettes, adjustable text size,
and high-contrast mode are built into the UI. The look and feel is inspired by
[GopherGrades](https://gophergrades.com).

## Project structure

```
TravelAgent/
├── frontend/        React + Vite UI (TypeScript planner/results + accessibility system)
│   ├── src/
│   │   ├── planner/      Multi-step PlanWizard (budget, dates, interests, ...)
│   │   ├── results/      Recommendation UI incl. BoardingPass + EditableItinerary (Verayn)
│   │   ├── context/      Accessibility (theme / text-size / high-contrast) state
│   │   └── styles/       Themes incl. colorblind-friendly palettes
│   └── frontend_design.md   Verayn's design language, adopted project-wide
└── backend/         Node + Express API, ES modules (all core logic)
    └── src/
        ├── agent/        Pipeline + stages, deterministic evaluator & budget math, safety
        │   ├── stages/       normalize / discovery / budgetFilter / evaluation / itinerary / budgetValidation
        │   ├── evaluator/    Nupur's deterministic destination evaluator
        │   └── itinerary/    Nupur's deterministic budget math + tiers
        ├── mcp/          Bear's MCP client manager, tool registry, tool executor
        ├── providers/    mock | openai | openai+mcp (the ONE place providers are chosen)
        ├── config/       env, mcpServers.json (Bear), scoringWeights.json (Nupur)
        ├── schemas/      Zod trust boundary (preferences + recommendation)
        └── ...
```

## How it works

1. The student fills out the accessible multi-step planner (budget, interests, dates, etc.).
2. The frontend produces a recommendation (today via a client-side agent; the backend
   `POST /api/recommendations` pipeline produces the same shape).
3. The backend pipeline normalizes input, discovers candidates (LLM or MCP tools),
   enforces the budget ceiling in code, runs the deterministic evaluator (hard constraints
   first, then transparent scoring), builds a tiered itinerary with deterministic budget
   math, and runs the authoritative budget validation.
4. Safety-language rules scrub any unsupported "safe/unsafe" claims before the response is
   returned and rendered in the accessible results view.

### Providers

The provider is chosen in `backend/src/providers/index.js` based on config + credentials:

- `mock` — deterministic, no API key required. **The demo runs fully on mock, offline.**
- `openai` — LLM-driven discovery/itinerary with a configured `OPENAI_API_KEY`.
- `openai+mcp` — Bear's MCP tool-calling loop feeding the pipeline; falls back to plain LLM
  (and then mock) if no MCP tools are reachable.

## Getting started

Quick start (two terminals):

```bash
# Terminal 1 — backend
cd backend
npm install
cp .env.example .env   # all values optional; mock runs with no key
npm run dev            # or: npm run test:mcp  (MCP diagnostic against a mock stdio server)

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` requests to the backend.

## Accessibility features

- **Colorblind-friendly themes**: default, deuteranopia, protanopia, and tritanopia palettes.
- **Large text / adjustable font size**: a text-size control scales the whole UI.
- **High-contrast mode** and keyboard-navigable, labeled form controls.
- **Editable accessible itinerary** with adjustment toggles and an `aria-live` save
  announcement (Verayn).

> Note: full WCAG conformance requires manual testing with assistive technologies and
> expert review.
