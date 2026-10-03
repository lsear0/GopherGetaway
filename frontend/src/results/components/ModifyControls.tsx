import type { TripModifier } from '../../agent';

interface ModifyControlsProps {
  onRegenerate: () => void;
  onModify: (modifier: TripModifier) => void;
  /** Disable while a new plan is being generated. */
  busy: boolean;
}

const MODIFIERS: Array<{ id: TripModifier; label: string; icon: string }> = [
  { id: 'cheaper', label: 'Make it cheaper', icon: '💸' },
  { id: 'more-adventurous', label: 'More adventurous', icon: '🧗' },
  { id: 'more-relaxing', label: 'More relaxing', icon: '🧘' },
  { id: 'shorten', label: 'Shorten trip', icon: '✂️' },
  { id: 'extend', label: 'Extend trip', icon: '📅' },
];

/**
 * The regenerate / modify toolbar. Regenerate is the prominent primary action; the five
 * modifiers are secondary chips. Each is a real button with a clear text label (icons are
 * decorative) so it's keyboard- and screen-reader-friendly. All disable while busy.
 */
export function ModifyControls({ onRegenerate, onModify, busy }: ModifyControlsProps) {
  return (
    <section className="modify" aria-label="Adjust your trip">
      <button
        type="button"
        className="button button--primary modify__regenerate"
        onClick={onRegenerate}
        disabled={busy}
      >
        <span aria-hidden="true">🔄 </span>
        Regenerate trip
      </button>

      <div className="modify__chips">
        {MODIFIERS.map((m) => (
          <button
            key={m.id}
            type="button"
            className="button button--ghost modify__chip"
            onClick={() => onModify(m.id)}
            disabled={busy}
          >
            <span aria-hidden="true">{m.icon} </span>
            {m.label}
          </button>
        ))}
      </div>
    </section>
  );
}
