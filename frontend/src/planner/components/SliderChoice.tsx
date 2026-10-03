import type { SliderValue } from '../types';

/**
 * A labeled 1–5 slider for spectrum preferences (packed ↔ relaxed, adventure ↔
 * relaxation). Uses a native range input so it is fully keyboard accessible and respects
 * the OS/assistive-tech slider affordances; the end labels sit on either side.
 */
interface SliderChoiceProps {
  id: string;
  leftLabel: string;
  rightLabel: string;
  value: SliderValue;
  onChange: (value: SliderValue) => void;
  /** A hidden accessible name for the slider itself. */
  ariaLabel: string;
}

export function SliderChoice({
  id,
  leftLabel,
  rightLabel,
  value,
  onChange,
  ariaLabel,
}: SliderChoiceProps) {
  return (
    <div className="slider-choice">
      <div className="slider-choice__labels">
        <span className="slider-choice__end">{leftLabel}</span>
        <span className="slider-choice__end slider-choice__end--right">{rightLabel}</span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        aria-label={ariaLabel}
        aria-valuetext={describe(value, leftLabel, rightLabel)}
        onChange={(e) => onChange(Number(e.target.value) as SliderValue)}
        className="slider-choice__input"
      />
    </div>
  );
}

function describe(value: SliderValue, left: string, right: string): string {
  switch (value) {
    case 1:
      return `Fully ${left}`;
    case 2:
      return `Mostly ${left}`;
    case 3:
      return 'A balance of both';
    case 4:
      return `Mostly ${right}`;
    case 5:
      return `Fully ${right}`;
    default:
      return 'A balance of both';
  }
}
