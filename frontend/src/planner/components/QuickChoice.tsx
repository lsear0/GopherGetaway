interface QuickChoiceItem {
  id: string;
  label: string;
}

interface QuickChoiceProps {
  items: ReadonlyArray<QuickChoiceItem>;
  /** The id of the active preset, or null when none matches. */
  activeId: string | null;
  onPick: (id: string) => void;
  ariaLabel: string;
}

/**
 * A row of "quick pick" pills (e.g. Weekend / 3–4 days / 5–7 days / 1–2 weeks). These are
 * shortcuts that set an underlying value; selecting one highlights it, and manually
 * changing the value elsewhere clears the highlight (activeId becomes null).
 */
export function QuickChoice({ items, activeId, onPick, ariaLabel }: QuickChoiceProps) {
  return (
    <div className="quick-choice" role="group" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`pill${isActive ? ' pill--active' : ''}`}
            aria-pressed={isActive}
            onClick={() => onPick(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
