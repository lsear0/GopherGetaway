import { usePlanner } from '../PlannerContext';
import { MoneyInput } from '../components/MoneyInput';
import { StepShell } from '../components/StepShell';
import type { StepComponentProps } from './stepProps';

/**
 * Step 1 — Budget.
 *
 * Asks for approximate monthly income and the amount they're comfortable spending. The
 * copy deliberately reassures the student that income is only used to personalize
 * recommendations and is never shared — keeping the tone non-judgmental.
 */
export function BudgetStep({ error, onBack, onNext, isFirst, isLast }: StepComponentProps) {
  const { preferences, update } = usePlanner();
  const { budget } = preferences;

  return (
    <StepShell
      title="What's your budget?"
      intro="This just helps us tailor suggestions to you. There are no wrong answers, and we never share this."
      error={error}
      onBack={onBack}
      onNext={onNext}
      isFirst={isFirst}
      isLast={isLast}
    >
      <MoneyInput
        id="monthly-income"
        label="Approximate monthly income (optional)"
        value={budget.monthlyIncomeUsd}
        placeholder="e.g. 1200"
        hint="Totally optional. It only helps us keep suggestions realistic for you."
        onChange={(monthlyIncomeUsd) =>
          update({ budget: { ...budget, monthlyIncomeUsd } })
        }
      />

      <MoneyInput
        id="trip-budget"
        label="What are you comfortable spending on this trip?"
        value={budget.tripBudgetUsd}
        placeholder="e.g. 800"
        hint="A rough number is fine — you can change it anytime."
        onChange={(tripBudgetUsd) => update({ budget: { ...budget, tripBudgetUsd } })}
      />
    </StepShell>
  );
}
