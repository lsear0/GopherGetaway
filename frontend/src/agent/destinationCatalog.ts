/**
 * A small curated catalog of destinations the mock agent chooses from. Each entry is
 * tagged with the interests it serves, a rough cost tier, distance from the Twin Cities,
 * and a decorative "poster" (emoji + gradient) so the UI has imagery without external
 * photo dependencies.
 *
 * This data is intentionally separate from the generator logic and the UI — a real
 * provider would replace the *generator*, and could ignore this catalog entirely.
 */
export interface CatalogDestination {
  name: string;
  region: string;
  tagline: string;
  /** Interest ids (matching planner INTEREST_OPTIONS) this place is strong for. */
  interests: string[];
  /** Relative cost tier: 1 (cheap) … 4 (pricey). Scales the generated budget. */
  costTier: 1 | 2 | 3 | 4;
  distanceKm: number;
  /** Leans adventure (low) ↔ relaxation (high), 1–5, to match the user's slider. */
  vibe: 1 | 2 | 3 | 4 | 5;
  poster: { emoji: string; gradient: [string, string] };
}

export const DESTINATION_CATALOG: ReadonlyArray<CatalogDestination> = [
  {
    name: 'Duluth & the North Shore',
    region: 'Minnesota, USA',
    tagline: 'Lake Superior cliffs, waterfalls, and cozy harbor town',
    interests: ['nature', 'hiking', 'photography', 'relaxation', 'roadtrips'],
    costTier: 1,
    distanceKm: 250,
    vibe: 3,
    poster: { emoji: '🏞️', gradient: ['#1e3a5f', '#2e7d6f'] },
  },
  {
    name: 'Chicago',
    region: 'Illinois, USA',
    tagline: 'Deep-dish, world-class museums, and lakefront skyline',
    interests: ['food', 'museums', 'architecture', 'music', 'nightlife', 'shopping', 'sports'],
    costTier: 2,
    distanceKm: 650,
    vibe: 2,
    poster: { emoji: '🏙️', gradient: ['#3a1c5f', '#b5452f'] },
  },
  {
    name: 'Denver & the Rockies',
    region: 'Colorado, USA',
    tagline: 'Mountain trails by day, craft breweries by night',
    interests: ['hiking', 'nature', 'adventure', 'skiing', 'sports', 'nightlife'],
    costTier: 3,
    distanceKm: 1300,
    vibe: 2,
    poster: { emoji: '🏔️', gradient: ['#2b5876', '#4e4376'] },
  },
  {
    name: 'Toronto',
    region: 'Ontario, Canada',
    tagline: 'A food-lover\u2019s melting pot with lakeside views',
    interests: ['food', 'museums', 'nightlife', 'architecture', 'shopping', 'music'],
    costTier: 3,
    distanceKm: 1400,
    vibe: 3,
    poster: { emoji: '🌆', gradient: ['#0f4c81', '#c0392b'] },
  },
  {
    name: 'Door County',
    region: 'Wisconsin, USA',
    tagline: 'Quiet beaches, cherry orchards, and lighthouse drives',
    interests: ['beaches', 'relaxation', 'nature', 'photography', 'roadtrips'],
    costTier: 2,
    distanceKm: 500,
    vibe: 5,
    poster: { emoji: '🏖️', gradient: ['#2193b0', '#6dd5ed'] },
  },
  {
    name: 'Banff',
    region: 'Alberta, Canada',
    tagline: 'Turquoise lakes and dramatic alpine adventure',
    interests: ['hiking', 'nature', 'adventure', 'skiing', 'photography'],
    costTier: 4,
    distanceKm: 2100,
    vibe: 2,
    poster: { emoji: '🏔️', gradient: ['#134e5e', '#71b280'] },
  },
  {
    name: 'New Orleans',
    region: 'Louisiana, USA',
    tagline: 'Live jazz, Creole food, and history on every corner',
    interests: ['music', 'food', 'history', 'nightlife', 'architecture'],
    costTier: 2,
    distanceKm: 1700,
    vibe: 3,
    poster: { emoji: '🎷', gradient: ['#5f2c82', '#49a09d'] },
  },
  {
    name: 'Yellowstone',
    region: 'Wyoming, USA',
    tagline: 'Geysers, wildlife, and backcountry on a grand scale',
    interests: ['nature', 'hiking', 'adventure', 'photography', 'relaxation'],
    costTier: 3,
    distanceKm: 1500,
    vibe: 3,
    poster: { emoji: '🦬', gradient: ['#355c7d', '#6c5b7b'] },
  },
];
