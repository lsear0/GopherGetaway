import {
  ACCOMMODATION_OPTIONS,
  DURATION_PRESETS,
  INTEREST_OPTIONS,
  TRANSPORTATION_OPTIONS,
  TRAVEL_STYLE_OPTIONS,
  type SliderValue,
  type TripPreferences,
} from './types';

/**
 * Human-readable label helpers used by the Review step (and anywhere a preference needs
 * to be shown as friendly text instead of an id). Keeping these in one module means the
 * review and any future summary views stay consistent.
 */

const CUSTOM_PREFIX = 'custom:';

export function interestLabel(id: string): string {
  if (id.startsWith(CUSTOM_PREFIX)) return id.slice(CUSTOM_PREFIX.length);
  return INTEREST_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export function travelStyleLabel(prefs: TripPreferences): string {
  return TRAVEL_STYLE_OPTIONS.find((o) => o.id === prefs.travelStyle)?.label ?? prefs.travelStyle;
}

export function transportationLabel(prefs: TripPreferences): string {
  return (
    TRANSPORTATION_OPTIONS.find((o) => o.id === prefs.transportation)?.label ??
    prefs.transportation
  );
}

export function accommodationLabel(prefs: TripPreferences): string {
  return (
    ACCOMMODATION_OPTIONS.find((o) => o.id === prefs.accommodation)?.label ??
    prefs.accommodation
  );
}

export function paceLabel(value: SliderValue): string {
  return ['Very packed', 'Packed', 'Balanced', 'Relaxed', 'Very relaxed'][value - 1];
}

export function adventureLabel(value: SliderValue): string {
  return ['All adventure', 'Mostly adventure', 'A mix', 'Mostly relaxation', 'All relaxation'][
    value - 1
  ];
}

/** A one-line description of the dates/duration choice. */
export function datesLabel(prefs: TripPreferences): string {
  const { dates } = prefs;
  if (dates.mode === 'exact' && dates.startDate && dates.endDate) {
    return `${dates.startDate} → ${dates.endDate}`;
  }
  const days = dates.lengthDays ?? 0;
  const preset = DURATION_PRESETS.find((p) => p.days === days);
  const base = preset ? `${preset.label} (${days} days)` : `${days} days`;
  return dates.mode === 'flexible' ? `${base}, flexible dates` : base;
}

/** Formats a USD amount, or a friendly fallback when not provided. */
export function money(value: number | null): string {
  if (value == null) return 'Not specified';
  return `$${value.toLocaleString()}`;
}
