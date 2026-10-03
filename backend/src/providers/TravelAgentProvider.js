/**
 * TravelAgentProvider — the abstraction that lets the app swap LLM backends without
 * touching the controller, routes, or frontend.
 *
 * Contract:
 *   name: string
 *   generateTrip(preferences): Promise<TripRecommendation>
 *   generateTripStream(preferences, onStage): Promise<TripRecommendation>
 *
 * Both methods take VALIDATED preferences (the controller validates with Zod first) and
 * resolve to a schema-checked TripRecommendation. `generateTripStream` additionally calls
 * `onStage(event)` as each pipeline stage starts/finishes so the transport layer can emit
 * progressive updates — but callers that don't care can just use `generateTrip`.
 *
 * Concrete providers (mock, openai) are implemented in sibling files and all drive the
 * SAME pipeline; they differ only in the `llm` step they inject into it. The UI never
 * learns which provider answered — provenance is carried in result.meta for diagnostics,
 * not for branching UI behavior.
 *
 * This base class documents the contract and provides a default `generateTrip` in terms
 * of `generateTripStream` so subclasses only have to implement the streaming path.
 */
export class TravelAgentProvider {
  /** @type {string} */
  name = 'base';

  // eslint-disable-next-line no-unused-vars
  async generateTripStream(preferences, onStage) {
    throw new Error('generateTripStream must be implemented by a concrete provider');
  }

  /** Non-streaming convenience wrapper. */
  async generateTrip(preferences) {
    return this.generateTripStream(preferences, () => {});
  }
}
