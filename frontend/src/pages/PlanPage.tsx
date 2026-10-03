import { Link } from 'react-router-dom';

// The accessibility toolbar is the existing plain-JSX component; its .d.ts gives types.
import AccessibilityToolbar from '../components/AccessibilityToolbar.jsx';
import { PlannerProvider } from '../planner/PlannerContext.js';
import { PlanWizard } from '../planner/PlanWizard.js';

/**
 * The /plan route. Provides the planner state to the wizard and renders the shared page
 * chrome (brand header + the existing accessibility toolbar, so large-text and colorblind
 * modes work here exactly as elsewhere).
 */
export function PlanPage() {
  return (
    <PlannerProvider>
      <div className="app app--wizard">
        <header className="app__header">
          <div className="app__brand">
            <Link to="/" className="app__home-link">
              GopherTrip
            </Link>
            <p className="app__tagline">Let's plan your trip.</p>
          </div>
          <AccessibilityToolbar />
        </header>

        <main id="main-content" className="app__main">
          <PlanWizard />
        </main>

        <footer className="app__footer">
          <p>Your answers are saved on this device as you go.</p>
        </footer>
      </div>
    </PlannerProvider>
  );
}
