interface ProgressIndicatorProps {
  steps: ReadonlyArray<{ id: string; title: string }>;
  /** Zero-based index of the current step. */
  current: number;
  /** Jump to a step (only allowed for already-visited steps). */
  onJump?: (index: number) => void;
}

/**
 * The wizard progress indicator: a labeled bar plus a dot per step. Shows "Step X of N",
 * marks completed steps, and lets the user click back to a visited step. The bar has
 * role=progressbar with aria values so assistive tech reads overall progress.
 */
export function ProgressIndicator({ steps, current, onJump }: ProgressIndicatorProps) {
  const total = steps.length;
  const percent = Math.round(((current + 1) / total) * 100);

  return (
    <div className="progress">
      <div className="progress__meta">
        <span className="progress__count">
          Step {current + 1} of {total}
        </span>
        <span className="progress__title">{steps[current]?.title}</span>
      </div>

      <div
        className="progress__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`Progress: step ${current + 1} of ${total}`}
      >
        <div className="progress__fill" style={{ width: `${percent}%` }} />
      </div>

      <ol className="progress__dots">
        {steps.map((step, index) => {
          const state =
            index < current ? 'done' : index === current ? 'current' : 'upcoming';
          const canJump = index < current && onJump;
          return (
            <li key={step.id} className={`progress__dot progress__dot--${state}`}>
              {canJump ? (
                <button
                  type="button"
                  className="progress__dot-btn"
                  onClick={() => onJump(index)}
                  aria-label={`Go back to ${step.title}`}
                >
                  <span aria-hidden="true">{step.title}</span>
                </button>
              ) : (
                <span aria-current={state === 'current' ? 'step' : undefined}>
                  {step.title}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
