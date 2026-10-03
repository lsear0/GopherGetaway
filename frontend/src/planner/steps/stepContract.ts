import type { TripPreferences } from '../types';

/**
 * Each step validates the slice of preferences it owns. Returning null means "valid,
 * allow advance"; returning a string is the user-facing message shown by StepShell.
 *
 * Validation lives next to the step definitions (not inside the components) so the wizard
 * can check the current step before navigating forward, and so the rules are easy to read
 * in one place.
 */
export type StepValidator = (prefs: TripPreferences) => string | null;

export interface StepDef {
  id: string;
  title: string;
  /** Short friendly line under the title. */
  intro: string;
  validate: StepValidator;
}
