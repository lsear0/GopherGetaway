import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';

import AccessibilityToolbar from '../components/AccessibilityToolbar.jsx';
import { loadPreferences, PLANNER_STORAGE_KEY } from '../planner/plannerStorage';
import { useRecommendation } from '../results/useRecommendation';
import { AiIntro } from '../results/components/AiIntro';
import { AnalyzingState } from '../results/components/AnalyzingState';
import { DestinationCard } from '../results/components/DestinationCard';
import { BudgetBreakdown } from '../results/components/BudgetBreakdown';
import { ItineraryTimeline } from '../results/components/ItineraryTimeline';
import { WhyThisTrip } from '../results/components/WhyThisTrip';
import { Alternatives } from '../results/components/Alternatives';
import { ModifyControls } from '../results/components/ModifyControls';
import { BoardingPass } from '../results/components/BoardingPass';
import { EditableItinerary } from '../results/components/EditableItinerary';

/**
 * The /results route — the AI travel-agent experience.
 *
 * It reads the questionnaire answers saved by the planner, hands them to the active
 * TravelAgent (currently the deterministic mock) via useRecommendation, and renders the
 * generated plan: agent intro, hero destination, budget breakdown, day-by-day itinerary,
 * why-this-trip, alternatives, and the regenerate/modify controls.
 *
 * The page depends only on the recommendation types and the agent interface, so swapping
 * in a real LLM-backed agent later changes nothing here.
 */
export function ResultsPage() {
  // Guard: no saved answers → send them to the questionnaire.
  const hasSaved = useMemo(() => {
    try {
      return localStorage.getItem(PLANNER_STORAGE_KEY) != null;
    } catch {
      return false;
    }
  }, []);

  // Load preferences once with a stable identity so the hook's effect doesn't re-run.
  const prefs = useMemo(() => loadPreferences(), []);

  const { status, recommendation, error, analyzingLabel, regenerate, applyModifier } =
    useRecommendation(prefs);

  if (!hasSaved) {
    return <Navigate to="/plan" replace />;
  }

  const busy = status === 'analyzing';

  return (
    <div className="app app--results">
      <header className="app__header">
        <div className="app__brand">
          <Link to="/" className="app__home-link">
            GopherTrip
          </Link>
          <p className="app__tagline">Your trip, planned.</p>
        </div>
        <AccessibilityToolbar />
      </header>

      <main id="main-content" className="app__main">
        {status === 'error' && (
          <p role="alert" className="app__error">
            {error ?? 'Something went wrong building your trip.'}{' '}
            <button type="button" className="button button--ghost" onClick={regenerate}>
              Try again
            </button>
          </p>
        )}

        {busy && <AnalyzingState label={analyzingLabel} />}

        {status === 'ready' && recommendation && (
          <div className="results">
            <AiIntro intro={recommendation.intro} />

            <DestinationCard
              destination={recommendation.destination}
              durationDays={recommendation.durationDays}
              travelers={recommendation.travelers}
              perTravelerUsd={recommendation.budget.perTravelerUsd}
            />

            <ModifyControls
              onRegenerate={regenerate}
              onModify={applyModifier}
              busy={busy}
            />

            <BoardingPass
              destination={recommendation.destination}
              alternatives={recommendation.alternatives}
              budgetLimitUsd={recommendation.budget.limitUsd}
            />

            <BudgetBreakdown budget={recommendation.budget} />

            <ItineraryTimeline itinerary={recommendation.itinerary} />

            <EditableItinerary itinerary={recommendation.itinerary} />

            <WhyThisTrip reasons={recommendation.reasons} />

            <Alternatives alternatives={recommendation.alternatives} />

            <p className="results__disclaimer">{recommendation.disclaimer}</p>

            <div className="results-actions">
              <Link to="/plan" className="button button--ghost">
                ← Edit answers
              </Link>
            </div>
          </div>
        )}
      </main>

      <footer className="app__footer">
        <p>Built for UMN students. Inspired by GopherGrades.</p>
      </footer>
    </div>
  );
}
