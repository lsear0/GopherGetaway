import { usePlanner } from '../PlannerContext';
import { NumberStepper } from '../components/NumberStepper';
import { StepShell } from '../components/StepShell';
import type { StepComponentProps } from './stepProps';

/**
 * Step 7 — Travelers. How many people are going (including the student).
 */
export function TravelersStep({
  error,
  onBack,
  onNext,
  isFirst,
  isLast,
}: StepComponentProps) {
  const { preferences, update } = usePlanner();

  return (
    <StepShell
      title="Who's coming along?"
      intro="Just you, or bringing friends? This helps size costs and plans."
      error={error}
      onBack={onBack}
      onNext={onNext}
      isFirst={isFirst}
      isLast={isLast}
    >
      <NumberStepper
        id="travelers"
        label="Number of travelers"
        value={preferences.travelers}
        min={1}
        max={20}
        unit={preferences.travelers === 1 ? 'person' : 'people'}
        onChange={(travelers) => update({ travelers })}
      />
    </StepShell>
  );
}
