import { usePlanner } from '../PlannerContext';
import { CardGroup } from '../components/CardGroup';
import { SliderChoice } from '../components/SliderChoice';
import { StepShell } from '../components/StepShell';
import { TRAVEL_STYLE_OPTIONS, type TravelStyle } from '../types';
import type { StepComponentProps } from './stepProps';

/**
 * Step 3 — Travel style.
 *
 * A single-choice card set for overall style, plus two spectrum sliders:
 * packed ↔ relaxed itinerary, and adventure ↔ relaxation.
 */
export function TravelStyleStep({
  error,
  onBack,
  onNext,
  isFirst,
  isLast,
}: StepComponentProps) {
  const { preferences, update } = usePlanner();

  return (
    <StepShell
      title="How do you like to travel?"
      intro="Pick the vibe that fits you best. You can fine-tune the feel below."
      error={error}
      onBack={onBack}
      onNext={onNext}
      isFirst={isFirst}
      isLast={isLast}
    >
      <CardGroup<TravelStyle>
        options={TRAVEL_STYLE_OPTIONS}
        value={preferences.travelStyle}
        onChange={(travelStyle) => update({ travelStyle })}
        ariaLabel="Travel style"
      />

      <div className="field">
        <label htmlFor="pace-slider">Itinerary pace</label>
        <SliderChoice
          id="pace-slider"
          leftLabel="Packed"
          rightLabel="Relaxed"
          value={preferences.pace}
          onChange={(pace) => update({ pace })}
          ariaLabel="Itinerary pace from packed to relaxed"
        />
      </div>

      <div className="field">
        <label htmlFor="adventure-slider">Trip feel</label>
        <SliderChoice
          id="adventure-slider"
          leftLabel="Adventure"
          rightLabel="Relaxation"
          value={preferences.adventureVsRelaxation}
          onChange={(adventureVsRelaxation) => update({ adventureVsRelaxation })}
          ariaLabel="Trip feel from adventure to relaxation"
        />
      </div>
    </StepShell>
  );
}
