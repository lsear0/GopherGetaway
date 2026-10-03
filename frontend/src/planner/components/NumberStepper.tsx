interface NumberStepperProps {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  /** Optional unit label, e.g. "people" or "days". */
  unit?: string;
}

/**
 * A +/- stepper for small counts (travelers, trip length). The buttons are convenient on
 * mobile, and the central value is a real number input so it stays keyboard-editable.
 */
export function NumberStepper({
  id,
  label,
  value,
  min = 1,
  max = 99,
  onChange,
  unit,
}: NumberStepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="stepper">
        <button
          type="button"
          className="stepper__btn"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - 1))}
        >
          −
        </button>
        <input
          id={id}
          type="number"
          className="stepper__value"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
        />
        <button
          type="button"
          className="stepper__btn"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + 1))}
        >
          +
        </button>
        {unit && <span className="stepper__unit">{unit}</span>}
      </div>
    </div>
  );
}
