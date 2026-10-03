interface Segment<T extends string> {
  id: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: ReadonlyArray<Segment<T>>;
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}

/**
 * A compact pill toggle for a small set of mutually-exclusive choices (e.g. the date
 * mode: exact / flexible / length). A radiogroup for accessibility.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {segments.map((seg) => {
        const isSelected = value === seg.id;
        return (
          <button
            key={seg.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`segmented__item${isSelected ? ' segmented__item--selected' : ''}`}
            onClick={() => onChange(seg.id)}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
