import type { Option } from '../types';

/**
 * A set of large selectable cards for single-choice questions (travel style,
 * transportation, accommodation). Implemented as a radiogroup so arrow keys move between
 * options and the selection is announced.
 */
interface CardGroupProps<T extends string> {
  options: ReadonlyArray<Option<T>>;
  value: T | null;
  onChange: (id: T) => void;
  ariaLabel: string;
  /** Visual density: 'cards' (big, with hints) or 'compact' (smaller tiles). */
  variant?: 'cards' | 'compact';
}

export function CardGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  variant = 'cards',
}: CardGroupProps<T>) {
  return (
    <div
      className={`card-group card-group--${variant}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const isSelected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`option-card${isSelected ? ' option-card--selected' : ''}`}
            onClick={() => onChange(opt.id)}
          >
            {opt.icon && (
              <span className="option-card__icon" aria-hidden="true">
                {opt.icon}
              </span>
            )}
            <span className="option-card__label">{opt.label}</span>
            {opt.hint && <span className="option-card__hint">{opt.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
