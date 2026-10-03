import type { StepDef } from './stepContract';

/**
 * The ordered step definitions driving the wizard: id, title (also used by the progress
 * indicator), intro, and a validator. Validators are intentionally lenient — most steps
 * have sensible defaults — but the ones that need a real answer (budget, interests,
 * dates) enforce it with a friendly message.
 */
export const STEP_DEFS: ReadonlyArray<StepDef> = [
  {
    id: 'budget',
    title: 'Budget',
    intro: 'Set your spending comfort zone.',
    validate: (p) => {
      if (p.budget.tripBudgetUsd == null) {
        return 'Add a rough trip budget so we can tailor suggestions.';
      }
      if (p.budget.tripBudgetUsd < 50) {
        return 'That budget looks a little low — try at least $50.';
      }
      return null;
    },
  },
  {
    id: 'interests',
    title: 'Interests',
    intro: 'Tell us what you enjoy.',
    validate: (p) =>
      p.interests.length === 0 ? 'Pick at least one interest so we can match you.' : null,
  },
  {
    id: 'style',
    title: 'Travel style',
    intro: 'Set the vibe.',
    validate: () => null,
  },
  {
    id: 'dates',
    title: 'Dates',
    intro: 'When and how long.',
    validate: (p) => {
      const { dates } = p;
      if (dates.mode === 'exact') {
        if (!dates.startDate || !dates.endDate) {
          return 'Add both a start and end date, or switch to flexible.';
        }
        if (dates.endDate < dates.startDate) {
          return 'Your end date is before your start date.';
        }
        return null;
      }
      if (!dates.lengthDays || dates.lengthDays < 1) {
        return 'Choose how many days your trip will be.';
      }
      return null;
    },
  },
  {
    id: 'transportation',
    title: 'Transportation',
    intro: 'How you want to travel.',
    validate: () => null,
  },
  {
    id: 'accommodation',
    title: 'Accommodation',
    intro: 'Where you want to stay.',
    validate: () => null,
  },
  {
    id: 'travelers',
    title: 'Travelers',
    intro: 'How many are going.',
    validate: (p) =>
      p.travelers < 1 ? 'There should be at least one traveler.' : null,
  },
  {
    id: 'review',
    title: 'Review',
    intro: 'Check everything over.',
    validate: () => null,
  },
];
