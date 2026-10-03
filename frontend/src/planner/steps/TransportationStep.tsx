import { usePlanner } from '../PlannerContext';
import { CardGroup } from '../components/CardGroup';
import { StepShell } from '../components/StepShell';
import { TRANSPORTATION_OPTIONS, type Transportation } from '../types';
import type { StepComponentProps } from './stepProps';

/**
 * Step 5 — Transportation. Single choice; "Don't care" is a first-class option so the
 * student is never forced into a preference they don't have.
 */
export function TransportationStep({
  error,
  onBack,
  onNext,
  isFirst,
  isLast,
}: StepComponentProps) {
  const { preferences, update } = usePlanner();

  return (
    <StepShell
      title="How do you want to get there?"
      intro="Pick whatever sounds right. No strong feelings? That's an option too."
      error={error}
      onBack={onBack}
      onNext={onNext}
      isFirst={isFirst}
      isLast={isLast}
    >
      <CardGroup<Transportation>
        options={TRANSPORTATION_OPTIONS}
        value={preferences.transportation}
        onChange={(transportation) => update({ transportation })}
        ariaLabel="Transportation preference"
        variant="compact"
      />
    </StepShell>
  );
}
