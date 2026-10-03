import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Accessibility settings shared across the app.
 *
 * - theme: a colorblind-friendly palette (applied as data-theme on <html>)
 * - textSize: scales the root font size (applied as data-text-size on <html>)
 * - highContrast: boolean toggle (applied as data-high-contrast on <html>)
 *
 * Settings persist to localStorage so a student's preferences survive reloads.
 */

export const THEMES = [
  { id: 'default', label: 'Default' },
  { id: 'deuteranopia', label: 'Deuteranopia (red-green)' },
  { id: 'protanopia', label: 'Protanopia (red-green)' },
  { id: 'tritanopia', label: 'Tritanopia (blue-yellow)' },
];

export const TEXT_SIZES = [
  { id: 'normal', label: 'Normal' },
  { id: 'large', label: 'Large' },
  { id: 'xlarge', label: 'Extra large' },
];

const STORAGE_KEY = 'gophertrip.accessibility';

const AccessibilityContext = createContext(null);

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore malformed/unavailable storage and fall back to defaults.
  }
  return { theme: 'default', textSize: 'normal', highContrast: false };
}

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  // Reflect settings onto <html> so CSS can respond via data-* attributes,
  // and persist them for next time.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.setAttribute('data-text-size', settings.textSize);
    root.setAttribute('data-high-contrast', String(settings.highContrast));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage may be unavailable (private mode); settings still apply this session.
    }
  }, [settings]);

  const value = useMemo(
    () => ({
      ...settings,
      setTheme: (theme) => setSettings((s) => ({ ...s, theme })),
      setTextSize: (textSize) => setSettings((s) => ({ ...s, textSize })),
      toggleHighContrast: () => setSettings((s) => ({ ...s, highContrast: !s.highContrast })),
    }),
    [settings],
  );

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

/** Hook for consuming accessibility settings. */
export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return ctx;
}
