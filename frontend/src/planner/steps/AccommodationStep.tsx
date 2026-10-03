import { usePlanner } from '../PlannerContext';
import { CardGroup } from '../components/CardGroup';
import { StepShell } from '../components/StepShell';
import { ACCOMMODATION_OPTIONS, type Accommodation } from '../types';
import type { StepComponentProps } from './stepProps';

/**
 * Step 6 — Accommodation. Single choice, with "Don't care" available.
 */
export function AccommodationStep({
  error,
  onBack,
  onNext,
  isFirst,
  isLast,
}: StepComponentProps) {
  const { preferences, update } = usePlanner();

  return (
    <StepShell
      title="Where do you want to stay?"
      intro="From a bunk in a hostel to your own rental — pick your comfort level."
      error={error}
      onBack={onBack}
      onNext={onNext}
      isFirst={isFirst}
      isLast={isLast}
    >
      <CardGroup<Accommodation>
        options={ACCOMMODATION_OPTIONS}
        value={preferences.accommodation}
        onChange={(accommodation) => update({ accommodation })}
        ariaLabel="Accommodation preference"
        variant="compact"
      />
    </StepShell>
  );
}
