import { usePlanner } from '../PlannerContext';
import { SegmentedControl } from '../components/SegmentedControl';
import { QuickChoice } from '../components/QuickChoice';
import { NumberStepper } from '../components/NumberStepper';
import { StepShell } from '../components/StepShell';
import { DURATION_PRESETS, type DateMode } from '../types';
import type { StepComponentProps } from './stepProps';

/**
 * Step 4 — Dates & duration.
 *
 * Three modes via a segmented control:
 *  - exact:    start + end date pickers
 *  - flexible: just a trip length (any time of year)
 *  - length:   a trip length with quick presets (Weekend, 3–4, 5–7, 1–2 weeks)
 *
 * The quick presets set lengthDays; typing a different length clears the active preset
 * highlight so the UI never lies about what's selected.
 */
const MODE_SEGMENTS: ReadonlyArray<{ id: DateMode; label: string }> = [
  { id: 'exact', label: 'Exact dates' },
  { id: 'flexible', label: 'Flexible' },
  { id: 'length', label: 'Just a length' },
];

export function DatesStep({ error, onBack, onNext, isFirst, isLast }: StepComponentProps) {
  const { preferences, update } = usePlanner();
  const { dates } = preferences;

  const activePreset =
    DURATION_PRESETS.find((p) => p.days === dates.lengthDays)?.id ?? null;

  const setMode = (mode: DateMode) => update({ dates: { ...dates, mode } });
  const setLength = (lengthDays: number) => update({ dates: { ...dates, lengthDays } });

  return (
    <StepShell
      title="When are you going?"
      intro="Know your dates? Great. Not sure yet? Flexible works too."
      error={error}
      onBack={onBack}
      onNext={onNext}
      isFirst={isFirst}
      isLast={isLast}
    >
      <SegmentedControl<DateMode>
        segments={MODE_SEGMENTS}
        value={dates.mode}
        onChange={setMode}
        ariaLabel="How you want to set your dates"
      />

      {dates.mode === 'exact' && (
        <div className="date-grid">
          <div className="field">
            <label htmlFor="start-date">Start date</label>
            <input
              id="start-date"
              type="date"
              value={dates.startDate ?? ''}
              onChange={(e) =>
                update({ dates: { ...dates, startDate: e.target.value || null } })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="end-date">End date</label>
            <input
              id="end-date"
              type="date"
              min={dates.startDate ?? undefined}
              value={dates.endDate ?? ''}
              onChange={(e) =>
                update({ dates: { ...dates, endDate: e.target.value || null } })
              }
            />
          </div>
        </div>
      )}

      {(dates.mode === 'length' || dates.mode === 'flexible') && (
        <>
          <QuickChoice
            items={DURATION_PRESETS}
            activeId={activePreset}
            onPick={(id) => {
              const preset = DURATION_PRESETS.find((p) => p.id === id);
              if (preset) setLength(preset.days);
            }}
            ariaLabel="Quick trip length options"
          />
          <NumberStepper
            id="length-days"
            label="Trip length"
            value={dates.lengthDays ?? 1}
            min={1}
            max={30}
            unit="days"
            onChange={setLength}
          />
        </>
      )}
    </StepShell>
  );
}
