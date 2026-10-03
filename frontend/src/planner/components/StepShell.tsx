import type { ReactNode } from 'react';

interface StepShellProps {
  title: string;
  /** A short, friendly one-liner under the title. */
  intro?: string;
  children: ReactNode;
  /** Validation message to show when the user tries to advance with invalid input. */
  error?: string | null;
  /** Back button handler; omit to hide (first step). */
  onBack?: () => void;
  onNext: () => void;
  /** Label for the primary button (e.g. "Next" or "Review"). */
  nextLabel?: string;
  isFirst?: boolean;
  isLast?: boolean;
}

/**
 * The consistent frame around every step: heading, intro, the step body, a live
 * validation region, and Back/Next navigation. Centralizing this keeps each step
 * component focused purely on its own question and guarantees uniform behavior
 * (keyboard focus, aria-live errors, button layout) everywhere.
 */
export function StepShell({
  title,
  intro,
  children,
  error,
  onBack,
  onNext,
  nextLabel = 'Next',
  isFirst = false,
  isLast = false,
}: StepShellProps) {
  return (
    <section className="step" aria-labelledby="step-heading">
      <h2 id="step-heading" className="step__title">
        {title}
      </h2>
      {intro && <p className="step__intro">{intro}</p>}

      <div className="step__body">{children}</div>

      {/* Validation feedback, announced politely to screen readers. */}
      <p className="step__error" role="alert">
        {error ?? ''}
      </p>

      <div className="step__nav">
        {!isFirst && onBack ? (
          <button type="button" className="button button--ghost" onClick={onBack}>
            ← Back
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="button button--primary" onClick={onNext}>
          {isLast ? nextLabel : `${nextLabel} →`}
        </button>
      </div>
    </section>
  );
}
