# GopherGetaway Frontend

React + Vite UI that holds all presentation and accessibility controls. It collects a
student's travel profile and renders the itinerary the backend generates.

## Setup

```bash
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api` to the backend at `http://localhost:3001`, so start the
backend too (see `../backend/README.md`).

## Structure

```
src/
├── main.jsx                       Entry — mounts App inside AccessibilityProvider
├── App.jsx                        Layout + request lifecycle (loading/error/result)
├── api/
│   └── tripClient.js              fetch wrapper for POST /api/trips
├── components/
│   ├── TripForm.jsx               Accessible profile form
│   ├── TripResult.jsx             Accessible itinerary view (aria-live)
│   └── AccessibilityToolbar.jsx   Theme / text-size / contrast controls
├── context/
│   └── AccessibilityContext.jsx   Shared a11y settings (persisted to localStorage)
└── styles/
    └── global.css                 Themes (incl. colorblind palettes) + text scaling
```

## Accessibility

Settings are applied as `data-*` attributes on `<html>` and read by CSS custom properties:

- `data-theme` — `default`, `deuteranopia`, `protanopia`, `tritanopia`
- `data-text-size` — `normal`, `large`, `xlarge`
- `data-high-contrast` — `true` / `false`

Other built-ins: a skip link, visible focus styles, labeled controls, an `aria-live`
result region, and `prefers-reduced-motion` support.

> These are skeleton implementations. Full WCAG conformance requires manual testing with
> assistive technologies and expert review.
