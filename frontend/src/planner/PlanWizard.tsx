import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { usePlanner } from './PlannerContext';
import { ProgressIndicator } from './components/ProgressIndicator';
import { STEP_DEFS } from './steps/stepDefs';
import { savePreferences } from './plannerStorage';

import { BudgetStep } from './steps/BudgetStep';
import { InterestsStep } from './steps/InterestsStep';
import { TravelStyleStep } from './steps/TravelStyleStep';
import { DatesStep } from './steps/DatesStep';
import { TransportationStep } from './steps/TransportationStep';
import { AccommodationStep } from './steps/AccommodationStep';
import { TravelersStep } from './steps/TravelersStep';
import { ReviewStep } from './steps/ReviewStep';

/**
 * The /plan wizard. Owns:
 *  - which step is active and the direction of travel (for the slide animation)
 *  - validation gating: a forward move only happens if the current step validates
 *  - back/edit navigation (answers are preserved in PlannerContext, so this is lossless)
 *  - a beforeunload guard so a reload/close doesn't silently drop progress
 *  - submit: persist the final preferences and go to /results
 *
 * Step bodies are dumb: they render their question against the planner context and call
 * onNext/onBack. All sequencing logic lives here.
 */
export function PlanWizard() {
  const navigate = useNavigate();
  const { preferences, dirty } = usePlanner();

  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const headingRef = useRef<HTMLDivElement>(null);

  const total = STEP_DEFS.length;
  const isFirst = index === 0;
  const isLast = index === total - 1;

  // Warn before the browser unloads with unsaved-but-dirty progress. Preferences are
  // already in localStorage, but this prevents a surprising mid-flow data loss.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty && !isLast) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, isLast]);

  // Move focus to the step heading region on step change for screen-reader orientation.
  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  const goTo = useCallback((next: number, dir: 'forward' | 'back') => {
    setDirection(dir);
    setError(null);
    setIndex(next);
  }, []);

  const handleNext = useCallback(() => {
    const def = STEP_DEFS[index];
    const validationError = def.validate(preferences);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (isLast) {
      handleSubmit();
      return;
    }
    goTo(index + 1, 'forward');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isLast, preferences, goTo]);

  const handleBack = useCallback(() => {
    if (isFirst) return;
    goTo(index - 1, 'back');
  }, [index, isFirst, goTo]);

  const handleEdit = useCallback(
    (stepIndex: number) => {
      goTo(stepIndex, 'back');
    },
    [goTo],
  );

  function handleSubmit() {
    // Persist the final answers (already saved on each change, but be explicit) and go.
    savePreferences(preferences);
    navigate('/results');
  }

  const stepProps = {
    error,
    onBack: handleBack,
    onNext: handleNext,
    isFirst,
    isLast,
  };

  function renderStep() {
    switch (STEP_DEFS[index].id) {
      case 'budget':
        return <BudgetStep {...stepProps} />;
      case 'interests':
        return <InterestsStep {...stepProps} />;
      case 'style':
        return <TravelStyleStep {...stepProps} />;
      case 'dates':
        return <DatesStep {...stepProps} />;
      case 'transportation':
        return <TransportationStep {...stepProps} />;
      case 'accommodation':
        return <AccommodationStep {...stepProps} />;
      case 'travelers':
        return <TravelersStep {...stepProps} />;
      case 'review':
        return <ReviewStep {...stepProps} onEdit={handleEdit} />;
      default:
        return null;
    }
  }

  return (
    <div className="wizard">
      <ProgressIndicator
        steps={STEP_DEFS}
        current={index}
        onJump={(i) => goTo(i, 'back')}
      />

      {/* Focus target + animation container. key forces a remount so the CSS
          enter animation runs on every step change. */}
      <div
        ref={headingRef}
        tabIndex={-1}
        className={`wizard__panel wizard__panel--${direction}`}
        key={STEP_DEFS[index].id}
      >
        {renderStep()}
      </div>
    </div>
  );
}
