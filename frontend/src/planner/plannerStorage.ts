import { createDefaultPreferences, type TripPreferences } from './types';

/**
 * localStorage persistence for trip preferences.
 *
 * Preferences are saved on every change so a student never loses answers to a reload or
 * an accidental tab close (one of the UX requirements). Loading is defensive: anything
 * malformed falls back to a fresh default rather than throwing.
 */

export const PLANNER_STORAGE_KEY = 'gophertrip.preferences';

export function loadPreferences(): TripPreferences {
  try {
    const raw = localStorage.getItem(PLANNER_STORAGE_KEY);
    if (!raw) return createDefaultPreferences();
    const parsed = JSON.parse(raw);
    // Merge over defaults so a saved object from an older shape still hydrates safely.
    return { ...createDefaultPreferences(), ...parsed };
  } catch {
    return createDefaultPreferences();
  }
}

export function savePreferences(prefs: TripPreferences): void {
  try {
    localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage may be unavailable (private mode); the wizard still works in-memory.
  }
}

export function clearPreferences(): void {
  try {
    localStorage.removeItem(PLANNER_STORAGE_KEY);
  } catch {
    // ignore
  }
}
