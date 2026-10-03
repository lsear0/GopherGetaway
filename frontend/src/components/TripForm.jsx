import { useState } from 'react';

/**
 * Accessible form for collecting a student travel profile.
 *
 * Accessibility notes:
 * - Every control has an associated <label> (clickable, screen-reader friendly).
 * - Required fields and help text are linked via aria-describedby.
 * - The submit button exposes a busy state while a request is in flight.
 */
export default function TripForm({ onSubmit, isLoading }) {
  const [income, setIncome] = useState('');
  const [interests, setInterests] = useState('');
  const [tripLengthDays, setTripLengthDays] = useState(5);
  const [departureCity, setDepartureCity] = useState('Minneapolis');
  const [notes, setNotes] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      income: income === '' ? null : Number(income),
      // Split the comma-separated interests into a clean list.
      interests: interests
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      tripLengthDays: Number(tripLengthDays),
      departureCity: departureCity.trim(),
      notes: notes.trim(),
    });
  }

  return (
    <form className="trip-form" onSubmit={handleSubmit} aria-labelledby="trip-form-heading">
      <h2 id="trip-form-heading">Tell us about your trip</h2>

      <div className="field">
        <label htmlFor="income">Annual income (USD)</label>
        <input
          id="income"
          name="income"
          type="number"
          min="0"
          inputMode="numeric"
          value={income}
          onChange={(e) => setIncome(e.target.value)}
          aria-describedby="income-help"
        />
        <p id="income-help" className="field__help">
          Used to keep your budget realistic. Optional.
        </p>
      </div>

      <div className="field">
        <label htmlFor="interests">Interests</label>
        <input
          id="interests"
          name="interests"
          type="text"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          aria-describedby="interests-help"
          placeholder="hiking, museums, food"
        />
        <p id="interests-help" className="field__help">
          Separate interests with commas.
        </p>
      </div>

      <div className="field">
        <label htmlFor="tripLengthDays">Trip length (days)</label>
        <input
          id="tripLengthDays"
          name="tripLengthDays"
          type="number"
          min="1"
          max="30"
          value={tripLengthDays}
          onChange={(e) => setTripLengthDays(e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="departureCity">Departure city</label>
        <input
          id="departureCity"
          name="departureCity"
          type="text"
          value={departureCity}
          onChange={(e) => setDepartureCity(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="notes">Anything else?</label>
        <textarea
          id="notes"
          name="notes"
          rows="3"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Accessibility needs, must-sees, travel companions..."
        />
      </div>

      <button type="submit" className="button button--primary" disabled={isLoading} aria-busy={isLoading}>
        {isLoading ? 'Building your trip…' : 'Build my trip'}
      </button>
    </form>
  );
}
