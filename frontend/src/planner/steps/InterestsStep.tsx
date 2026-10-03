import { useState } from 'react';

import { usePlanner } from '../PlannerContext';
import { ChipGroup } from '../components/ChipGroup';
import { StepShell } from '../components/StepShell';
import { INTEREST_OPTIONS } from '../types';
import type { StepComponentProps } from './stepProps';

/**
 * Step 2 — Interests.
 *
 * A grid of toggleable chips plus a free-text field for a custom interest. Custom
 * interests are stored in the same `interests` array, prefixed so they're easy to tell
 * apart from the preset ids when rendering the review.
 */
const CUSTOM_PREFIX = 'custom:';

export function InterestsStep({ error, onBack, onNext, isFirst, isLast }: StepComponentProps) {
  const { preferences, update } = usePlanner();
  const [customText, setCustomText] = useState('');

  const selected = preferences.interests;

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    update({ interests: next });
  }

  function addCustom() {
    const text = customText.trim();
    if (!text) return;
    const id = `${CUSTOM_PREFIX}${text}`;
    if (!selected.includes(id)) {
      update({ interests: [...selected, id] });
    }
    setCustomText('');
  }

  const customInterests = selected.filter((id) => id.startsWith(CUSTOM_PREFIX));

  return (
    <StepShell
      title="What are you into?"
      intro="Pick anything that sounds fun. The more you choose, the better we can match you."
      error={error}
      onBack={onBack}
      onNext={onNext}
      isFirst={isFirst}
      isLast={isLast}
    >
      <ChipGroup
        options={INTEREST_OPTIONS}
        selected={selected}
        onToggle={toggle}
        ariaLabel="Interests"
      />

      <div className="field custom-interest">
        <label htmlFor="custom-interest">Something else?</label>
        <div className="custom-interest__row">
          <input
            id="custom-interest"
            type="text"
            value={customText}
            placeholder="Add your own interest"
            maxLength={40}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <button type="button" className="button button--ghost" onClick={addCustom}>
            Add
          </button>
        </div>

        {customInterests.length > 0 && (
          <ul className="custom-interest__list">
            {customInterests.map((id) => (
              <li key={id} className="chip chip--selected chip--removable">
                <span className="chip__label">{id.slice(CUSTOM_PREFIX.length)}</span>
                <button
                  type="button"
                  className="chip__remove"
                  aria-label={`Remove ${id.slice(CUSTOM_PREFIX.length)}`}
                  onClick={() => toggle(id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </StepShell>
  );
}
