import { usePlanner } from '../PlannerContext';
import { StepShell } from '../components/StepShell';
import {
  accommodationLabel,
  adventureLabel,
  datesLabel,
  interestLabel,
  money,
  paceLabel,
  transportationLabel,
  travelStyleLabel,
} from '../summarize';
import type { StepComponentProps } from './stepProps';

interface ReviewStepProps extends StepComponentProps {
  /** Jump back to a specific step index to edit it. */
  onEdit: (stepIndex: number) => void;
}

/**
 * Step 8 — Review.
 *
 * A clean, scannable summary of everything the student chose, grouped into cards. Each
 * card has an Edit link that jumps straight back to the relevant step (answers are
 * preserved, so editing is lossless). The primary button here generates the trip.
 */
export function ReviewStep({ error, onBack, onNext, onEdit, isLast }: ReviewStepProps) {
  const { preferences } = usePlanner();
  const p = preferences;

  const interests = p.interests.length
    ? p.interests.map(interestLabel).join(', ')
    : 'None selected yet';

  const rows: Array<{ label: string; value: string; editStep: number }> = [
    {
      label: 'Budget',
      value: `${money(p.budget.tripBudgetUsd)} for the trip`,
      editStep: 0,
    },
    { label: 'Interests', value: interests, editStep: 1 },
    {
      label: 'Travel style',
      value: `${travelStyleLabel(p)} · ${paceLabel(p.pace)} · ${adventureLabel(
        p.adventureVsRelaxation,
      )}`,
      editStep: 2,
    },
    { label: 'Dates', value: datesLabel(p), editStep: 3 },
    { label: 'Transportation', value: transportationLabel(p), editStep: 4 },
    { label: 'Accommodation', value: accommodationLabel(p), editStep: 5 },
    {
      label: 'Travelers',
      value: `${p.travelers} ${p.travelers === 1 ? 'person' : 'people'}`,
      editStep: 6,
    },
  ];

  return (
    <StepShell
      title="Does this look right?"
      intro="Here's your trip at a glance. Edit anything, then let's build it."
      error={error}
      onBack={onBack}
      onNext={onNext}
      nextLabel="Build my trip"
      isLast={isLast}
    >
      <dl className="review">
        {rows.map((row) => (
          <div key={row.label} className="review__row">
            <dt className="review__label">{row.label}</dt>
            <dd className="review__value">{row.value}</dd>
            <button
              type="button"
              className="review__edit"
              onClick={() => onEdit(row.editStep)}
            >
              Edit
            </button>
          </div>
        ))}
      </dl>

      {p.budget.monthlyIncomeUsd != null && (
        <p className="review__note">
          We'll keep suggestions realistic for a monthly income around{' '}
          {money(p.budget.monthlyIncomeUsd)}. This stays private.
        </p>
      )}
    </StepShell>
  );
}
