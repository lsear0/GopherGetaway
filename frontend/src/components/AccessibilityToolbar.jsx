import {
  TEXT_SIZES,
  THEMES,
  useAccessibility,
} from '../context/AccessibilityContext.js';

/**
 * Toolbar that lets students adjust accessibility settings:
 * colorblind-friendly palette, text size, and high-contrast mode.
 *
 * All controls are standard, labeled form elements so they work with keyboards
 * and screen readers out of the box.
 */
export default function AccessibilityToolbar() {
  const { theme, textSize, highContrast, setTheme, setTextSize, toggleHighContrast } =
    useAccessibility();

  return (
    <section className="a11y-toolbar" aria-label="Accessibility settings">
      <div className="a11y-toolbar__group">
        <label htmlFor="a11y-theme">Color theme</label>
        <select id="a11y-theme" value={theme} onChange={(e) => setTheme(e.target.value)}>
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="a11y-toolbar__group">
        <label htmlFor="a11y-text-size">Text size</label>
        <select
          id="a11y-text-size"
          value={textSize}
          onChange={(e) => setTextSize(e.target.value)}
        >
          {TEXT_SIZES.map((size) => (
            <option key={size.id} value={size.id}>
              {size.label}
            </option>
          ))}
        </select>
      </div>

      <div className="a11y-toolbar__group a11y-toolbar__group--checkbox">
        <input
          id="a11y-contrast"
          type="checkbox"
          checked={highContrast}
          onChange={toggleHighContrast}
        />
        <label htmlFor="a11y-contrast">High contrast</label>
      </div>
    </section>
  );
}
