import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.jsx';
import { AccessibilityProvider } from './context/AccessibilityContext.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* AccessibilityProvider supplies theme + text-size settings to the whole app. */}
    <AccessibilityProvider>
      <App />
    </AccessibilityProvider>
  </React.StrictMode>,
);
