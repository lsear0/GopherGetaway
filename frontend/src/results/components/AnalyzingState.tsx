interface AnalyzingStateProps {
  label: string;
}

/**
 * The "agent is working" state. A calm animated indicator plus a rotating caption that
 * names what the agent is doing, so the wait reads as deliberate analysis rather than a
 * generic spinner. The caption is in an aria-live region so screen-reader users hear
 * progress; the animation is decorative and disabled under reduced-motion via CSS.
 */
export function AnalyzingState({ label }: AnalyzingStateProps) {
  return (
    <div className="analyzing" role="status" aria-live="polite">
      <div className="analyzing__orb" aria-hidden="true">
        <span className="analyzing__dot" />
        <span className="analyzing__dot" />
        <span className="analyzing__dot" />
      </div>
      <p className="analyzing__label">{label}</p>
      <p className="analyzing__sub">Your GopherTrip agent is building a plan just for you.</p>
    </div>
  );
}
