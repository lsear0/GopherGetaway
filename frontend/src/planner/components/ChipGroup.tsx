import type { Option } from '../types';

/**
 * A grid of toggleable chips for multi-select (e.g. interests). Each chip is a real
 * <button> with aria-pressed, so it's keyboard- and screen-reader-friendly out of the box.
 */
interface ChipGroupProps {
  options: ReadonlyArray<Option>;
  /** Currently selected ids. */
  selected: string[];
  onToggle: (id: string) => void;
  /** Accessible label describing the group. */
  ariaLabel: string;
}

export function ChipGroup({ options, selected, onToggle, ariaLabel }: ChipGroupProps) {
  return (
    <div className="chip-group" role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            className={`chip${isSelected ? ' chip--selected' : ''}`}
            aria-pressed={isSelected}
            onClick={() => onToggle(opt.id)}
          >
            {opt.icon && (
              <span className="chip__icon" aria-hidden="true">
                {opt.icon}
              </span>
            )}
            <span className="chip__label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
