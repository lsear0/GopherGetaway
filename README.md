# GopherTrip — AI Travel Agent for UMN Students

A website where University of Minnesota students enter their income, interests, and travel
preferences, and an AI travel agent builds a personalized trip for them.

Accessibility is a first-class feature: colorblind-friendly palettes and adjustable (large)
text are built into the UI. The look and feel is inspired by
[GopherGrades](https://gophergrades.com).

## Project structure

```
TravelAgent/
├── frontend/        React + Vite UI (all presentation + accessibility controls)
│   ├── src/
│   │   ├── components/   Form, trip display, accessibility toolbar
│   │   ├── context/      Accessibility (theme / text-size) state
│   │   ├── api/          Thin client that talks to the backend
│   │   └── styles/       Themes incl. colorblind-friendly palettes
│   └── ...
└── backend/         Node + Express API (all core logic)
    └── src/
        ├── routes/       HTTP endpoints
        ├── controllers/  Request/response handling
        ├── services/     OpenAI integration + trip-building logic
        └── ...
```

## How it works

1. The student fills out an accessible form (income, interests, trip length, etc.).
2. The frontend sends that profile to the backend `POST /api/trips` endpoint.
3. The backend builds a prompt and calls the OpenAI API to generate a trip itinerary.
4. The itinerary is returned and rendered in an accessible trip view.

## Getting started

This is a skeleton. Each app has its own README with run instructions:

- Backend: [`backend/README.md`](backend/README.md)
- Frontend: [`frontend/README.md`](frontend/README.md)

Quick start (two terminals):

```bash
# Terminal 1 — backend
cd backend
npm install
cp .env.example .env   # then add your OPENAI_API_KEY
npm run dev

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` requests to the backend, so you only interact with the
frontend URL during development.

## Accessibility features

- **Colorblind-friendly themes**: default, deuteranopia, protanopia, and tritanopia palettes.
- **Large text / adjustable font size**: a text-size control scales the whole UI.
- **High-contrast mode** and keyboard-navigable, labeled form controls.

> Note: these are skeleton implementations meant to establish structure. Full WCAG
> conformance requires manual testing with assistive technologies and expert review.
