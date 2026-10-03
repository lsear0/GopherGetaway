import { useEffect, useMemo, useState } from 'react';

import type { ItineraryDay } from '../../agent';

interface EditableItineraryProps {
  itinerary: ItineraryDay[];
}

type AdjustmentId = 'less-walking' | 'more-rest' | 'quiet-evenings' | 'food-support';

const ADJUSTMENTS: { id: AdjustmentId; label: string; description: string; note: string }[] = [
  {
    id: 'less-walking',
    label: 'Lower walking load',
    description: 'Keep stops closer together and rely more on transit.',
    note: 'Keep the first stops in the same area and use transit where possible.',
  },
  {
    id: 'more-rest',
    label: 'More rest time',
    description: 'Protect a slower pace with built-in breaks.',
    note: 'Protect a longer midday break so the day does not feel packed.',
  },
  {
    id: 'quiet-evenings',
    label: 'Quieter evenings',
    description: 'Trade louder nightlife for calmer night plans.',
    note: 'Keep the evening calm with a quieter meal or an early night.',
  },
  {
    id: 'food-support',
    label: 'Dietary planning',
    description: 'Leave room to choose restaurants with known menu options.',
    note: 'Leave room to confirm menus ahead or pick clearer dietary options.',
  },
];

interface EditableDay {
  day: number;
  title: string;
  summary: string;
}

/**
 * An editable, accessible itinerary (adapted from Verayn's travel-agent-ui).
 *
 * - Adjustment toggles (lower walking / more rest / quieter evenings / dietary planning)
 *   append accessibility-minded notes to each day's summary.
 * - Every day title/summary is directly editable via keyboard-accessible fields.
 * - An aria-live region announces saves and resets to assistive technology.
 *
 * This is additive and self-contained: it renders alongside the existing read-only
 * timeline and never mutates the recommendation itself.
 */
export function EditableItinerary({ itinerary }: EditableItineraryProps) {
  const base = useMemo<EditableDay[]>(
    () =>
      itinerary.map((d) => ({
        day: d.day,
        title: d.title,
        summary: summaryFor(d),
      })),
    [itinerary],
  );

  const [adjustments, setAdjustments] = useState<AdjustmentId[]>([]);
  const [days, setDays] = useState<EditableDay[]>(base);
  const [notice, setNotice] = useState('');

  // Recompute the suggested outline whenever the base plan or adjustments change.
  const suggested = useMemo<EditableDay[]>(() => {
    const extraNotes = ADJUSTMENTS.filter((a) => adjustments.includes(a.id)).map((a) => a.note);
    return base.map((d) => ({
      ...d,
      summary: [d.summary, ...extraNotes].filter(Boolean).join(' '),
    }));
  }, [base, adjustments]);

  useEffect(() => {
    setDays(suggested);
  }, [suggested]);

  function toggleAdjustment(id: AdjustmentId) {
    setAdjustments((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    );
    const a = ADJUSTMENTS.find((x) => x.id === id);
    setNotice(`Updated itinerary adjustments: ${a?.label ?? id}.`);
  }

  function updateField(day: number, field: 'title' | 'summary', value: string) {
    setDays((current) => current.map((d) => (d.day === day ? { ...d, [field]: value } : d)));
  }

  function handleBlur(day: number, fieldLabel: string) {
    setNotice(`Saved edits for Day ${day} ${fieldLabel}.`);
  }

  function resetAll() {
    setDays(suggested);
    setNotice('Reset the itinerary to the planner suggestions.');
  }

  return (
    <section className="editable-itinerary" aria-labelledby="editable-itinerary-title">
      <div className="editable-itinerary__header">
        <div>
          <p className="editable-itinerary__eyebrow">Accessible itinerary editing</p>
          <h2 id="editable-itinerary-title">Adjust the plan before you lock it in</h2>
        </div>
        <button type="button" className="button button--ghost" onClick={resetAll}>
          Reset all days
        </button>
      </div>

      <p id="editable-itinerary-help" className="editable-itinerary__help">
        Use these controls to lower walking, build in more rest, keep evenings quieter, or
        leave room for dietary planning. Every field is keyboard-accessible and editable.
      </p>

      <fieldset className="editable-itinerary__adjustments">
        <legend>Accessibility and itinerary adjustments</legend>
        <div className="editable-itinerary__adjustment-grid">
          {ADJUSTMENTS.map((option) => {
            const checked = adjustments.includes(option.id);
            return (
              <label
                key={option.id}
                className={`adjustment-card${checked ? ' adjustment-card--selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleAdjustment(option.id)}
                />
                <span className="adjustment-card__label">{option.label}</span>
                <small className="adjustment-card__desc">{option.description}</small>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* aria-live announcement for saves/resets */}
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {notice}
      </div>

      <ol className="editable-itinerary__days" aria-describedby="editable-itinerary-help">
        {days.map((d) => (
          <li key={d.day} className="editable-day">
            <label className="editable-day__field">
              <span className="editable-day__label">Day {d.day} title</span>
              <input
                type="text"
                value={d.title}
                onChange={(e) => updateField(d.day, 'title', e.target.value)}
                onBlur={() => handleBlur(d.day, 'title')}
              />
            </label>
            <label className="editable-day__field">
              <span className="editable-day__label">Day {d.day} plan</span>
              <textarea
                rows={3}
                value={d.summary}
                onChange={(e) => updateField(d.day, 'summary', e.target.value)}
                onBlur={() => handleBlur(d.day, 'plan')}
              />
            </label>
          </li>
        ))}
      </ol>
    </section>
  );
}

function summaryFor(day: ItineraryDay): string {
  const names = day.blocks
    .flatMap((b) => b.activities.map((a) => a.name))
    .slice(0, 3)
    .join(', ');
  return names ? `${day.title}: ${names}.` : day.title;
}
