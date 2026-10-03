/**
 * Typed data models for an AI-generated trip recommendation.
 *
 * These are the frontend's self-contained contract. The mock generator produces objects
 * of these shapes today; a real LLM-backed agent (calling the backend
 * /api/recommendations pipeline) can produce the same shapes tomorrow, and no UI
 * component has to change. UI components depend ONLY on these types — never on how the
 * data was produced.
 */

/** One line item in the budget breakdown. */
export interface BudgetCategory {
  id: 'transportation' | 'accommodation' | 'food' | 'activities' | 'misc';
  label: string;
  amountUsd: number;
  /** 0–100, share of the total trip cost. Precomputed so the UI never has to. */
  percent: number;
}

export interface BudgetBreakdown {
  totalUsd: number;
  perTravelerUsd: number;
  categories: BudgetCategory[];
  /** Whether the estimate lands within the student's stated budget. */
  withinBudget: boolean;
  /** The student's stated budget ceiling, for honest comparison in the UI. */
  limitUsd: number | null;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export interface ItineraryActivity {
  name: string;
  description: string;
  estimatedCostUsd: number;
  /** Approximate time spent on the activity, in minutes. */
  durationMin: number;
  /** Realistic travel time to reach this activity from the previous one, in minutes. */
  travelFromPreviousMin: number;
}

export interface ItineraryBlock {
  timeOfDay: TimeOfDay;
  activities: ItineraryActivity[];
}

export interface ItineraryDay {
  day: number;
  title: string;
  /** Morning / afternoon / evening blocks. */
  blocks: ItineraryBlock[];
  /** Sum of activity costs for the day (precomputed). */
  dayCostUsd: number;
}

export interface Destination {
  name: string;
  /** e.g. "Minnesota, USA" */
  region: string;
  /** One-liner shown under the destination name. */
  tagline: string;
  /** A short paragraph on why this destination fits the student. */
  whyItFits: string;
  estimatedTotalCostUsd: number;
  /** Great-circle-ish distance from the departure city, in km. */
  distanceKm: number;
  /** Interest ids this destination is strong for (used to explain the match). */
  matchedInterests: string[];
  /**
   * A decorative image. We use a gradient + emoji "poster" rather than remote photos so
   * the MVP has no external image dependencies or licensing concerns; the field is here
   * so a real provider can supply a photo URL later.
   */
  imageUrl?: string;
  /** Emoji poster + gradient seed used when imageUrl is absent. */
  poster: { emoji: string; gradient: [string, string] };
}

/** A considered alternative, framed as a tradeoff — never ranked best/worst. */
export interface AlternativeDestination {
  name: string;
  region: string;
  approxCostUsd: number;
  explanation: string;
  /** How it differs from the primary pick (the tradeoff). */
  tradeoff: string;
  poster: { emoji: string; gradient: [string, string] };
}

/** A single "why this trip" bullet mapping the plan back to a preference. */
export interface MatchReason {
  /** Short label, e.g. "Within budget" or "Matches hiking". */
  label: string;
  /** One-line explanation. */
  detail: string;
  /** Whether this reason is satisfied (true) or a caveat the student should know (false). */
  satisfied: boolean;
}

export interface TripRecommendation {
  /** A personalized, agent-voiced introduction referencing the student's choices. */
  intro: string;
  destination: Destination;
  durationDays: number;
  travelers: number;
  budget: BudgetBreakdown;
  itinerary: ItineraryDay[];
  reasons: MatchReason[];
  alternatives: AlternativeDestination[];
  /** Honest reminder that costs are estimates. */
  disclaimer: string;
  /** Provenance so the UI can note how it was produced, without branching on it. */
  meta: {
    generator: 'mock' | 'llm';
    generatedAt: string;
  };
}

/** The modifiers the "regenerate / modify" controls can request. */
export type TripModifier =
  | 'regenerate'
  | 'cheaper'
  | 'more-adventurous'
  | 'more-relaxing'
  | 'shorten'
  | 'extend';
