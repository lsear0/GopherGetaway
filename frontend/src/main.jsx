import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import App from './App.jsx';
import { HomePage } from './pages/HomePage.tsx';
import { PlanPage } from './pages/PlanPage.tsx';
import { ResultsPage } from './pages/ResultsPage.tsx';
import { AccessibilityProvider } from './context/AccessibilityContext.jsx';
import './styles/global.css';
import './styles/planner.css';
import './styles/results.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* AccessibilityProvider supplies theme + text-size settings to the whole app. */}
    <AccessibilityProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/results" element={<ResultsPage />} />
          {/* The original single-shot demo form, kept available during the transition. */}
          <Route path="/legacy" element={<App />} />
        </Routes>
      </BrowserRouter>
    </AccessibilityProvider>
  </React.StrictMode>,
);
