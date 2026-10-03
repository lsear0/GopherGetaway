/**
 * Renders a generated itinerary in an accessible, structured way.
 * Uses an aria-live region so screen readers announce when a trip appears.
 */
export default function TripResult({ trip, source }) {
  if (!trip) return null;

  return (
    <section className="trip-result" aria-live="polite" aria-labelledby="trip-result-heading">
      {source === 'mock' && (
        <p className="trip-result__notice" role="note">
          Showing sample data. Add an OpenAI API key to the backend for real suggestions.
        </p>
      )}

      <h2 id="trip-result-heading">{trip.title}</h2>
      <p className="trip-result__summary">{trip.summary}</p>

      {typeof trip.estimatedBudgetUsd === 'number' && (
        <p className="trip-result__budget">
          Estimated budget: <strong>${trip.estimatedBudgetUsd.toLocaleString()}</strong>
        </p>
      )}

      <ol className="trip-result__days">
        {(trip.days || []).map((day) => (
          <li key={day.day} className="trip-day">
            <h3 className="trip-day__title">
              Day {day.day}: {day.title}
            </h3>
            <ul className="trip-day__activities">
              {(day.activities || []).map((activity, index) => (
                <li key={index}>{activity}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
