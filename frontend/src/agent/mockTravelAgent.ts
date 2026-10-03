import type { TripPreferences } from '../planner/types';
import {
  accommodationLabel,
  interestLabel,
  transportationLabel,
  travelStyleLabel,
} from '../planner/summarize';
import type { TravelAgent } from './TravelAgent';
import { DESTINATION_CATALOG, type CatalogDestination } from './destinationCatalog';
import type {
  AlternativeDestination,
  BudgetBreakdown,
  BudgetCategory,
  Destination,
  ItineraryActivity,
  ItineraryDay,
  MatchReason,
  TimeOfDay,
  TripModifier,
  TripRecommendation,
} from './recommendationTypes';

/**
 * MockTravelAgent — a deterministic, offline trip generator.
 *
 * It behaves like an agent would: it scores destinations against the student's interests,
 * budget, distance tolerance, and adventure/relaxation lean, picks the best fit, splits a
 * realistic budget, and builds an interest-driven, pace-aware itinerary. Everything is
 * seeded from the preferences (plus a nonce the modifiers bump), so results are stable
 * for a given input but change meaningfully when the student asks to regenerate or tweak.
 *
 * It implements the TravelAgent interface, so a real LLM-backed agent can replace it
 * wholesale without touching the UI.
 */
export class MockTravelAgent implements TravelAgent {
  async generateTrip(prefs: TripPreferences): Promise<TripRecommendation> {
    return build(prefs, 0, null);
  }

  async applyModifier(
    prefs: TripPreferences,
    current: TripRecommendation,
    modifier: TripModifier,
  ): Promise<TripRecommendation> {
    // Translate each modifier into an adjusted preferences object + a seed bump so the
    // plan visibly changes. The preferences themselves are not persisted; this is a
    // "what-if" the student is exploring on the results page.
    const adjusted: TripPreferences = structuredCloneSafe(prefs);
    let seedBump = hashString(modifier) + (current.meta.generatedAt.length % 7) + 1;

    switch (modifier) {
      case 'cheaper':
        if (adjusted.budget.tripBudgetUsd != null) {
          adjusted.budget.tripBudgetUsd = Math.max(
            50,
            Math.round(adjusted.budget.tripBudgetUsd * 0.75),
          );
        }
        break;
      case 'more-adventurous':
        adjusted.adventureVsRelaxation = clamp5(adjusted.adventureVsRelaxation - 2);
        adjusted.pace = clamp5(adjusted.pace - 1);
        break;
      case 'more-relaxing':
        adjusted.adventureVsRelaxation = clamp5(adjusted.adventureVsRelaxation + 2);
        adjusted.pace = clamp5(adjusted.pace + 1);
        break;
      case 'shorten':
        setLength(adjusted, Math.max(1, currentDuration(current) - 1));
        break;
      case 'extend':
        setLength(adjusted, Math.min(30, currentDuration(current) + 1));
        break;
      case 'regenerate':
      default:
        seedBump += 3;
        break;
    }

    return build(adjusted, seedBump, modifier);
  }
}

// ---- Core builder --------------------------------------------------------------------

function build(
  prefs: TripPreferences,
  seedBump: number,
  modifier: TripModifier | null,
): TripRecommendation {
  const duration = effectiveDuration(prefs);
  const travelers = Math.max(1, prefs.travelers);
  const seed = preferenceSeed(prefs) + seedBump;
  const rng = mulberry32(seed);

  const ranked = rankDestinations(prefs);
  // Rotate the winner by the seed so regenerate/modify can surface a different top pick
  // while still honoring the ranking (we only rotate among the top few good fits).
  const topPool = ranked.slice(0, Math.min(3, ranked.length));
  const chosen = topPool[seed % topPool.length];

  const destination = toDestination(chosen, prefs);
  const budget = buildBudget(prefs, chosen, duration, travelers);
  // The destination's headline cost is the computed budget total (kept in sync here so
  // the card and the breakdown never disagree).
  destination.estimatedTotalCostUsd = budget.totalUsd;
  const itinerary = buildItinerary(prefs, chosen, duration, budget, rng);
  const reasons = buildReasons(prefs, chosen, budget, duration);
  const alternatives = buildAlternatives(prefs, ranked, chosen);
  const intro = buildIntro(prefs, destination, duration, modifier);

  return {
    intro,
    destination,
    durationDays: duration,
    travelers,
    budget,
    itinerary,
    reasons,
    alternatives,
    disclaimer:
      'These costs are AI-generated estimates, not confirmed bookings. Check prices and ' +
      'availability before you book.',
    meta: { generator: 'mock', generatedAt: new Date().toISOString() },
  };
}

// ---- Destination ranking -------------------------------------------------------------

/** Score every catalog destination against the preferences and return them best-first. */
function rankDestinations(prefs: TripPreferences): CatalogDestination[] {
  const interests = normalizedInterests(prefs);
  const budget = prefs.budget.tripBudgetUsd;
  const tierCost = [0, 600, 1100, 1800, 2600]; // rough total for cost tiers 1–4

  return [...DESTINATION_CATALOG]
    .map((d) => {
      let score = 0;
      // Interest overlap is the biggest driver.
      const overlap = d.interests.filter((i) => interests.includes(i)).length;
      score += overlap * 10;
      // Vibe closeness to the adventure/relaxation slider.
      score += 5 - Math.abs(d.vibe - prefs.adventureVsRelaxation);
      // Budget fit: reward staying under budget, penalize going over.
      if (budget != null) {
        const est = tierCost[d.costTier];
        score += est <= budget ? 4 : -6;
      }
      // Mild closeness bonus (students often prefer nearer trips).
      score += Math.max(0, 3 - Math.floor(d.distanceKm / 700));
      return { d, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.d);
}

function toDestination(d: CatalogDestination, prefs: TripPreferences): Destination {
  const interests = normalizedInterests(prefs);
  const matched = d.interests.filter((i) => interests.includes(i));
  return {
    name: d.name,
    region: d.region,
    tagline: d.tagline,
    whyItFits: destinationWhy(d, matched),
    estimatedTotalCostUsd: 0, // filled from budget total by the caller view via budget
    distanceKm: d.distanceKm,
    matchedInterests: matched,
    poster: d.poster,
  };
}

function destinationWhy(d: CatalogDestination, matched: string[]): string {
  const interestText =
    matched.length > 0
      ? `It lines up with your interest in ${joinNicely(matched.map(interestLabel))}`
      : 'It offers a well-rounded mix of things to do';
  return `${interestText}, and ${d.tagline.toLowerCase()}. At roughly ${d.distanceKm} km from the Twin Cities, it's a realistic trip to pull off.`;
}

// ---- Budget --------------------------------------------------------------------------

function buildBudget(
  prefs: TripPreferences,
  d: CatalogDestination,
  duration: number,
  travelers: number,
): BudgetBreakdown {
  const limit = prefs.budget.tripBudgetUsd;

  // Base total from cost tier, scaled by duration and travelers (sublinear on travelers
  // since lodging/transport are often shared).
  const tierBase = [0, 450, 850, 1300, 1900][d.costTier];
  const styleMult = { backpacker: 0.75, balanced: 1, comfort: 1.35, luxury: 1.9 }[
    prefs.travelStyle
  ];
  const durationFactor = 0.6 + duration * 0.14;
  const travelerFactor = 1 + (travelers - 1) * 0.6;

  let total = Math.round(tierBase * styleMult * durationFactor * travelerFactor);
  // If the student gave a budget, nudge the estimate to sit near (ideally under) it.
  if (limit != null && total > limit) {
    total = Math.round(limit * 0.96);
  }

  // Category split depends on how far (transport share) and lodging choice.
  const transportShare = d.distanceKm > 1000 ? 0.34 : d.distanceKm > 500 ? 0.26 : 0.16;
  const lodgingShare = { hostel: 0.18, hotel: 0.3, rental: 0.26, camping: 0.1, any: 0.24 }[
    prefs.accommodation
  ];
  const foodShare = 0.22;
  const activitiesShare = 0.18;
  // Misc gets the remainder so the shares always sum to 1.
  const miscShare = Math.max(
    0.05,
    1 - (transportShare + lodgingShare + foodShare + activitiesShare),
  );

  const raw: Array<{ id: BudgetCategory['id']; label: string; share: number }> = [
    { id: 'transportation', label: 'Transportation', share: transportShare },
    { id: 'accommodation', label: 'Accommodation', share: lodgingShare },
    { id: 'food', label: 'Food', share: foodShare },
    { id: 'activities', label: 'Activities', share: activitiesShare },
    { id: 'misc', label: 'Miscellaneous', share: miscShare },
  ];

  const categories: BudgetCategory[] = raw.map((c) => ({
    id: c.id,
    label: c.label,
    amountUsd: Math.round(total * c.share),
    percent: Math.round(c.share * 100),
  }));

  // Fix any rounding drift so category amounts sum exactly to total.
  const summed = categories.reduce((s, c) => s + c.amountUsd, 0);
  if (categories.length > 0) categories[categories.length - 1].amountUsd += total - summed;

  return {
    totalUsd: total,
    perTravelerUsd: Math.round(total / travelers),
    categories,
    withinBudget: limit == null ? true : total <= limit,
    limitUsd: limit,
  };
}

// ---- Itinerary -----------------------------------------------------------------------

function buildItinerary(
  prefs: TripPreferences,
  d: CatalogDestination,
  duration: number,
  budget: BudgetBreakdown,
  rng: () => number,
): ItineraryDay[] {
  const interests = normalizedInterests(prefs);
  const focusInterests = d.interests.filter((i) => interests.includes(i));
  const palette = focusInterests.length ? focusInterests : d.interests;

  // Pace controls how many blocks have activities. Packed (1) → all three; relaxed (5) →
  // fewer, lighter days.
  const blocksByPace: Record<number, TimeOfDay[]> = {
    1: ['morning', 'afternoon', 'evening'],
    2: ['morning', 'afternoon', 'evening'],
    3: ['morning', 'afternoon', 'evening'],
    4: ['morning', 'afternoon'],
    5: ['morning', 'afternoon'],
  };
  const activeBlocks = blocksByPace[prefs.pace] ?? ['morning', 'afternoon', 'evening'];

  const activitiesBudget = budget.categories.find((c) => c.id === 'activities')?.amountUsd ?? 0;
  const perActivity = Math.max(
    8,
    Math.round(activitiesBudget / (duration * activeBlocks.length || 1)),
  );

  const days: ItineraryDay[] = [];
  for (let i = 0; i < duration; i++) {
    const blocks = activeBlocks.map((timeOfDay, blockIdx) => {
      const interest = palette[(i + blockIdx) % palette.length];
      const activity = makeActivity(timeOfDay, interest, d, perActivity, blockIdx, rng);
      return { timeOfDay, activities: [activity] };
    });
    const dayCostUsd = blocks.reduce(
      (s, b) => s + b.activities.reduce((a, act) => a + act.estimatedCostUsd, 0),
      0,
    );
    days.push({
      day: i + 1,
      title: dayTitle(i, duration, d, palette[i % palette.length]),
      blocks,
      dayCostUsd,
    });
  }
  return days;
}

function makeActivity(
  timeOfDay: TimeOfDay,
  interestId: string,
  d: CatalogDestination,
  perActivity: number,
  blockIdx: number,
  rng: () => number,
): ItineraryActivity {
  const label = interestLabel(interestId);
  const templates: Record<TimeOfDay, (x: string) => [string, string]> = {
    morning: (x) => [`Morning ${x.toLowerCase()}`, `Start the day with ${x.toLowerCase()} near ${d.name}.`],
    afternoon: (x) => [`Afternoon ${x.toLowerCase()}`, `Spend the afternoon on ${x.toLowerCase()}, with time to wander.`],
    evening: (x) => [`Evening ${x.toLowerCase()}`, `Wind down with ${x.toLowerCase()} and a local bite.`],
  };
  const [name, description] = templates[timeOfDay](label);
  // Cost varies a little by block and a touch of seeded randomness; evenings cost more.
  const multiplier = timeOfDay === 'evening' ? 1.3 : timeOfDay === 'afternoon' ? 1 : 0.7;
  const estimatedCostUsd = Math.max(0, Math.round(perActivity * multiplier * (0.8 + rng() * 0.4)));
  const durationMin = [120, 150, 180][Math.floor(rng() * 3)];
  // First activity of the day has no inbound travel; later ones get a realistic hop.
  const travelFromPreviousMin = blockIdx === 0 ? 0 : [10, 15, 20, 30][Math.floor(rng() * 4)];
  return { name, description, estimatedCostUsd, durationMin, travelFromPreviousMin };
}

function dayTitle(i: number, duration: number, d: CatalogDestination, interestId: string): string {
  if (i === 0) return `Arrive in ${shortName(d.name)}`;
  if (i === duration - 1) return `Last day & departure`;
  return `Day ${i + 1}: ${interestLabel(interestId)}`;
}

// ---- Reasons -------------------------------------------------------------------------

function buildReasons(
  prefs: TripPreferences,
  d: CatalogDestination,
  budget: BudgetBreakdown,
  duration: number,
): MatchReason[] {
  const interests = normalizedInterests(prefs);
  const matched = d.interests.filter((i) => interests.includes(i));
  const reasons: MatchReason[] = [];

  reasons.push({
    label: budget.withinBudget ? 'Fits your budget' : 'Slightly over budget',
    detail: budget.withinBudget
      ? `Estimated at $${budget.totalUsd.toLocaleString()}${
          budget.limitUsd != null ? `, under your $${budget.limitUsd.toLocaleString()} limit` : ''
        }.`
      : `Estimated at $${budget.totalUsd.toLocaleString()}, a bit above your limit — try "Make it cheaper".`,
    satisfied: budget.withinBudget,
  });

  if (matched.length) {
    reasons.push({
      label: `Matches ${joinNicely(matched.slice(0, 3).map(interestLabel))}`,
      detail: 'The itinerary is built around the interests you picked.',
      satisfied: true,
    });
  }

  reasons.push({
    label: d.distanceKm <= 700 ? 'Short travel time' : 'Reachable travel distance',
    detail: `About ${d.distanceKm} km from the Twin Cities.`,
    satisfied: d.distanceKm <= 1500,
  });

  reasons.push({
    label: `Works for a ${duration}-day trip`,
    detail: `The plan is paced for ${duration} ${duration === 1 ? 'day' : 'days'} at a ${paceWord(
      prefs.pace,
    )} tempo.`,
    satisfied: true,
  });

  reasons.push({
    label: adventureBalanceLabel(prefs.adventureVsRelaxation),
    detail: 'Daily plans blend active outings with downtime to match your preferred feel.',
    satisfied: true,
  });

  return reasons;
}

// ---- Alternatives --------------------------------------------------------------------

function buildAlternatives(
  prefs: TripPreferences,
  ranked: CatalogDestination[],
  chosen: CatalogDestination,
): AlternativeDestination[] {
  const others = ranked.filter((d) => d.name !== chosen.name).slice(0, 3);
  return others.map((d) => {
    const tierBase = [0, 450, 850, 1300, 1900][d.costTier];
    const approxCostUsd = Math.round(
      tierBase * { backpacker: 0.75, balanced: 1, comfort: 1.35, luxury: 1.9 }[prefs.travelStyle],
    );
    return {
      name: d.name,
      region: d.region,
      approxCostUsd,
      explanation: d.tagline,
      tradeoff: tradeoffVs(chosen, d),
      poster: d.poster,
    };
  });
}

/** Describe how alternative `d` differs from the chosen pick — a tradeoff, not a ranking. */
function tradeoffVs(chosen: CatalogDestination, d: CatalogDestination): string {
  if (d.costTier < chosen.costTier) return 'More budget-friendly, with a different scene.';
  if (d.costTier > chosen.costTier) return 'A pricier option, but a bigger experience.';
  if (d.distanceKm < chosen.distanceKm) return 'Closer to home, so less time in transit.';
  if (d.distanceKm > chosen.distanceKm) return 'Further away, but worth the extra travel.';
  if (d.vibe < chosen.vibe) return 'Leans more adventurous than your main pick.';
  if (d.vibe > chosen.vibe) return 'A more laid-back pace than your main pick.';
  return 'A similar fit with a different character.';
}

// ---- Intro ---------------------------------------------------------------------------

function buildIntro(
  prefs: TripPreferences,
  destination: Destination,
  duration: number,
  modifier: TripModifier | null,
): string {
  const interests = normalizedInterests(prefs);
  const interestText =
    interests.length > 0
      ? `your interest in ${joinNicely(interests.slice(0, 3).map(interestLabel))}`
      : 'what you told me you enjoy';
  const styleText = travelStyleLabel(prefs).toLowerCase();

  const lead = modifier ? modifierLead(modifier) : 'Based on your answers,';
  return (
    `${lead} I looked at ${styleText} trips that fit ${interestText}, your budget, and a ` +
    `${duration}-day timeframe — and ${destination.name} stood out. ` +
    `Getting there by ${transportationLabel(prefs).toLowerCase()} and staying in a ` +
    `${accommodationLabel(prefs).toLowerCase()} keeps it true to how you like to travel.`
  );
}

function modifierLead(modifier: TripModifier): string {
  switch (modifier) {
    case 'cheaper':
      return 'I trimmed the budget and re-planned —';
    case 'more-adventurous':
      return 'I dialed up the adventure —';
    case 'more-relaxing':
      return 'I eased off the pace for a more relaxing trip —';
    case 'shorten':
      return 'I tightened this into a shorter trip —';
    case 'extend':
      return 'I stretched this into a longer trip —';
    case 'regenerate':
    default:
      return 'Here\u2019s another take —';
  }
}

// ---- Small helpers -------------------------------------------------------------------

const CUSTOM_PREFIX = 'custom:';

function normalizedInterests(prefs: TripPreferences): string[] {
  // Drop custom free-text interests for matching (catalog uses known ids) but keep known ids.
  return prefs.interests.filter((i) => !i.startsWith(CUSTOM_PREFIX));
}

function effectiveDuration(prefs: TripPreferences): number {
  const { dates } = prefs;
  if (dates.mode === 'exact' && dates.startDate && dates.endDate) {
    const start = new Date(dates.startDate).getTime();
    const end = new Date(dates.endDate).getTime();
    const days = Math.round((end - start) / 86_400_000) + 1;
    return Math.min(30, Math.max(1, days));
  }
  return Math.min(30, Math.max(1, dates.lengthDays ?? 3));
}

function currentDuration(current: TripRecommendation): number {
  return current.durationDays;
}

function setLength(prefs: TripPreferences, days: number): void {
  prefs.dates = { mode: 'length', startDate: null, endDate: null, lengthDays: days };
}

function paceWord(pace: number): string {
  return ['very packed', 'packed', 'balanced', 'relaxed', 'very relaxed'][pace - 1] ?? 'balanced';
}

function adventureBalanceLabel(v: number): string {
  if (v <= 2) return 'Leans into adventure';
  if (v >= 4) return 'Leans into relaxation';
  return 'Balances adventure and relaxation';
}

function joinNicely(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function shortName(name: string): string {
  return name.split(/[&,]/)[0].trim();
}

function clamp5(n: number): 1 | 2 | 3 | 4 | 5 {
  return Math.min(5, Math.max(1, n)) as 1 | 2 | 3 | 4 | 5;
}

/** A stable integer seed derived from the meaningful preference fields. */
function preferenceSeed(prefs: TripPreferences): number {
  const parts = [
    prefs.budget.tripBudgetUsd ?? 0,
    prefs.travelStyle,
    prefs.pace,
    prefs.adventureVsRelaxation,
    prefs.transportation,
    prefs.accommodation,
    prefs.travelers,
    prefs.interests.join(','),
    effectiveDuration(prefs),
  ].join('|');
  return hashString(parts);
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Tiny deterministic PRNG so itinerary jitter is stable for a given seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function structuredCloneSafe<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
