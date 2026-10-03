import type { ItineraryActivity, ItineraryBlock, ItineraryDay, TimeOfDay } from '../../agent';
import { minutes, usd } from '../format';

interface ItineraryTimelineProps {
  itinerary: ItineraryDay[];
}

const TIME_META: Record<TimeOfDay, { label: string; icon: string }> = {
  morning: { label: 'Morning', icon: '🌅' },
  afternoon: { label: 'Afternoon', icon: '☀️' },
  evening: { label: 'Evening', icon: '🌙' },
};

/**
 * The day-by-day itinerary, rendered as a vertical timeline of day cards. Each day groups
 * activities into morning / afternoon / evening. Travel time between consecutive
 * activities is shown as its own connector so the plan reads realistically.
 */
export function ItineraryTimeline({ itinerary }: ItineraryTimelineProps) {
  return (
    <section className="itinerary" aria-labelledby="itinerary-heading">
      <h2 id="itinerary-heading">Day-by-day plan</h2>
      <ol className="itinerary__days">
        {itinerary.map((day) => (
          <li key={day.day}>
            <DayCard day={day} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function DayCard({ day }: { day: ItineraryDay }) {
  return (
    <article className="day-card" aria-labelledby={`day-${day.day}-title`}>
      <header className="day-card__header">
        <span className="day-card__badge" aria-hidden="true">
          {day.day}
        </span>
        <div>
          <h3 id={`day-${day.day}-title`} className="day-card__title">
            <span className="visually-hidden">Day {day.day}: </span>
            {day.title}
          </h3>
          <p className="day-card__cost">Approx. {usd(day.dayCostUsd)} for the day</p>
        </div>
      </header>

      <div className="day-card__blocks">
        {day.blocks.map((block) => (
          <BlockRow key={block.timeOfDay} block={block} />
        ))}
      </div>
    </article>
  );
}

function BlockRow({ block }: { block: ItineraryBlock }) {
  const meta = TIME_META[block.timeOfDay];
  return (
    <div className="block-row">
      <h4 className="block-row__time">
        <span className="block-row__icon" aria-hidden="true">
          {meta.icon}
        </span>
        {meta.label}
      </h4>
      <ul className="block-row__activities">
        {block.activities.map((activity, i) => (
          <ActivityItem key={i} activity={activity} />
        ))}
      </ul>
    </div>
  );
}

function ActivityItem({ activity }: { activity: ItineraryActivity }) {
  return (
    <li className="activity">
      {activity.travelFromPreviousMin > 0 && (
        <p className="activity__travel">
          <span aria-hidden="true">🚶 </span>
          {minutes(activity.travelFromPreviousMin)} travel from the previous stop
        </p>
      )}
      <div className="activity__body">
        <p className="activity__name">{activity.name}</p>
        <p className="activity__desc">{activity.description}</p>
        <p className="activity__meta">
          <span className="activity__chip">{minutes(activity.durationMin)}</span>
          <span className="activity__chip">
            {activity.estimatedCostUsd === 0 ? 'Free' : `~${usd(activity.estimatedCostUsd)}`}
          </span>
        </p>
      </div>
    </li>
  );
}
