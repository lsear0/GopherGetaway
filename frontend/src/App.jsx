import { useState } from 'react';

import AccessibilityToolbar from './components/AccessibilityToolbar.jsx';
import TripForm from './components/TripForm.jsx';
import TripResult from './components/TripResult.jsx';
import { requestTrip } from './api/tripClient.js';

/**
 * Top-level layout. Owns the request lifecycle (loading / error / result) and
 * passes handlers down to the form and result components.
 */
export default function App() {
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [trip, setTrip] = useState(null);
  const [source, setSource] = useState(null);
  const [error, setError] = useState('');

  async function handleSubmit(profile) {
    setStatus('loading');
    setError('');
    try {
      const data = await requestTrip(profile);
      setTrip(data.trip);
      setSource(data.source);
      setStatus('success');
    } catch (err) {
      setError(err.message || 'Could not build your trip. Please try again.');
      setStatus('error');
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">GopherGetaway</h1>
        <p className="app__tagline">An AI travel agent for University of Minnesota students.</p>
        <AccessibilityToolbar />
      </header>

      <main id="main-content" className="app__main">
        <TripForm onSubmit={handleSubmit} isLoading={status === 'loading'} />

        {/* Status region announced to screen readers via aria-live in the components. */}
        {status === 'error' && (
          <p role="alert" className="app__error">
            {error}
          </p>
        )}

        {status === 'success' && trip && <TripResult trip={trip} source={source} />}
      </main>

      <footer className="app__footer">
        <p>Built for UMN students. Inspired by GopherGrades.</p>
      </footer>
    </div>
  );
}
