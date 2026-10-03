interface MoneyInputProps {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  hint?: string;
  placeholder?: string;
}

/**
 * A currency-prefixed number field for budget questions. Keeps the value as a number (or
 * null when empty) so the data model never has to parse strings later.
 */
export function MoneyInput({ id, label, value, onChange, hint, placeholder }: MoneyInputProps) {
  return (
    <div className="field money-field">
      <label htmlFor={id}>{label}</label>
      <div className="money-field__wrap">
        <span className="money-field__prefix" aria-hidden="true">
          $
        </span>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          step={10}
          value={value ?? ''}
          placeholder={placeholder}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === '' ? null : Math.max(0, Number(raw)));
          }}
        />
      </div>
      {hint && (
        <p id={`${id}-hint`} className="field__help">
          {hint}
        </p>
      )}
    </div>
  );
}
