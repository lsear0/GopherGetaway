/**
 * The typed data model for a student's trip preferences.
 *
 * This is the single source of truth for the questionnaire's shape. Every step reads and
 * writes a slice of this object, the Review step summarizes it, and it is what gets saved
 * to localStorage and handed to /results.
 */

// ---- Option unions ------------------------------------------------------------------

export type TravelStyle = 'backpacker' | 'balanced' | 'comfort' | 'luxury';

export type Transportation = 'fly' | 'drive' | 'bus' | 'train' | 'any';

export type Accommodation = 'hostel' | 'hotel' | 'rental' | 'camping' | 'any';

export type DateMode = 'exact' | 'flexible' | 'length';

/** 1 (very packed) … 5 (very relaxed) on the pace slider. */
export type SliderValue = 1 | 2 | 3 | 4 | 5;

// ---- The preferences object ---------------------------------------------------------

export interface BudgetPrefs {
  /** Approximate monthly income in USD. Optional, never required, framed non-judgmentally. */
  monthlyIncomeUsd: number | null;
  /** Amount the student is comfortable spending on this trip, in USD. */
  tripBudgetUsd: number | null;
}

export interface DatePrefs {
  mode: DateMode;
  /** ISO date strings (yyyy-mm-dd) when mode === 'exact'. */
  startDate: string | null;
  endDate: string | null;
  /** Trip length in days when mode === 'length' or 'flexible'. */
  lengthDays: number | null;
}

export interface TripPreferences {
  budget: BudgetPrefs;
  /** Selected interest ids (from INTEREST_OPTIONS) plus any custom free-text interests. */
  interests: string[];
  travelStyle: TravelStyle;
  /** 1 = packed itinerary, 5 = relaxed itinerary. */
  pace: SliderValue;
  /** 1 = all adventure, 5 = all relaxation. */
  adventureVsRelaxation: SliderValue;
  dates: DatePrefs;
  transportation: Transportation;
  accommodation: Accommodation;
  /** Number of people traveling, including the student. */
  travelers: number;
}

// ---- Option metadata (labels + icons for the UI) ------------------------------------

export interface Option<T extends string = string> {
  id: T;
  label: string;
  /** A short emoji used as a lightweight, decorative icon on cards/chips. */
  icon?: string;
  /** Optional one-line helper shown under the label. */
  hint?: string;
}

export const INTEREST_OPTIONS: ReadonlyArray<Option> = [
  { id: 'nature', label: 'Nature', icon: '🌲' },
  { id: 'hiking', label: 'Hiking', icon: '🥾' },
  { id: 'skiing', label: 'Skiing', icon: '🎿' },
  { id: 'beaches', label: 'Beaches', icon: '🏖️' },
  { id: 'food', label: 'Food', icon: '🍜' },
  { id: 'nightlife', label: 'Nightlife', icon: '🌃' },
  { id: 'museums', label: 'Museums', icon: '🏛️' },
  { id: 'history', label: 'History', icon: '📜' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'music', label: 'Music', icon: '🎶' },
  { id: 'photography', label: 'Photography', icon: '📷' },
  { id: 'gaming', label: 'Gaming', icon: '🎮' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️' },
  { id: 'architecture', label: 'Architecture', icon: '🏰' },
  { id: 'roadtrips', label: 'Road trips', icon: '🚗' },
  { id: 'adventure', label: 'Adventure', icon: '🧗' },
  { id: 'relaxation', label: 'Relaxation', icon: '🧘' },
];

export const TRAVEL_STYLE_OPTIONS: ReadonlyArray<Option<TravelStyle>> = [
  { id: 'backpacker', label: 'Budget backpacker', icon: '🎒', hint: 'Stretch every dollar' },
  { id: 'balanced', label: 'Balanced', icon: '⚖️', hint: 'A mix of value and comfort' },
  { id: 'comfort', label: 'Comfort', icon: '🛋️', hint: 'Treat yourself a little' },
  { id: 'luxury', label: 'Luxury', icon: '✨', hint: 'Go all out' },
];

export const TRANSPORTATION_OPTIONS: ReadonlyArray<Option<Transportation>> = [
  { id: 'fly', label: 'Fly', icon: '✈️' },
  { id: 'drive', label: 'Drive', icon: '🚗' },
  { id: 'bus', label: 'Bus', icon: '🚌' },
  { id: 'train', label: 'Train', icon: '🚆' },
  { id: 'any', label: "Don't care", icon: '🤷' },
];

export const ACCOMMODATION_OPTIONS: ReadonlyArray<Option<Accommodation>> = [
  { id: 'hostel', label: 'Hostel', icon: '🛏️' },
  { id: 'hotel', label: 'Hotel', icon: '🏨' },
  { id: 'rental', label: 'Airbnb-style rental', icon: '🏠' },
  { id: 'camping', label: 'Camping', icon: '⛺' },
  { id: 'any', label: "Don't care", icon: '🤷' },
];

export interface DurationPreset {
  id: string;
  label: string;
  days: number;
}

export const DURATION_PRESETS: ReadonlyArray<DurationPreset> = [
  { id: 'weekend', label: 'Weekend', days: 2 },
  { id: 'short', label: '3–4 days', days: 4 },
  { id: 'week', label: '5–7 days', days: 7 },
  { id: 'long', label: '1–2 weeks', days: 14 },
];

// ---- Defaults -----------------------------------------------------------------------

/** A fresh, empty-but-valid preferences object. Used to seed state on first visit. */
export function createDefaultPreferences(): TripPreferences {
  return {
    budget: { monthlyIncomeUsd: null, tripBudgetUsd: null },
    interests: [],
    travelStyle: 'balanced',
    pace: 3,
    adventureVsRelaxation: 3,
    dates: { mode: 'length', startDate: null, endDate: null, lengthDays: 7 },
    transportation: 'any',
    accommodation: 'any',
    travelers: 1,
  };
}
