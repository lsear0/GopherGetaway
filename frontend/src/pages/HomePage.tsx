import { Link } from 'react-router-dom';

import AccessibilityToolbar from '../components/AccessibilityToolbar.jsx';

/**
 * A minimal landing page with a clear call to action into the planner. Kept intentionally
 * light — the other developer's frontend work owns the broader marketing/home experience;
 * this just guarantees "/" routes somewhere sensible and links to /plan.
 */
export function HomePage() {
  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <h1 className="app__title">GopherTrip</h1>
          <p className="app__tagline">
            An AI travel agent for University of Minnesota students.
          </p>
        </div>
        <AccessibilityToolbar />
      </header>

      <main id="main-content" className="app__main">
        <section className="hero">
          <h2 className="hero__headline">Tell us what you're into. We'll plan the trip.</h2>
          <p className="hero__sub">
            A few quick questions about your budget, interests, and style — then let our AI
            travel agent do the rest.
          </p>
          <Link to="/plan" className="button button--primary button--lg">
            Start planning →
          </Link>
        </section>
      </main>

      <footer className="app__footer">
        <p>Built for UMN students. Inspired by GopherGrades.</p>
      </footer>
    </div>
  );
}
