import type { MatchReason } from '../../agent';

interface WhyThisTripProps {
  reasons: MatchReason[];
}

/**
 * "Why this trip?" — maps the recommendation back to the student's preferences. Each
 * reason uses a text label plus a ✓ / ! glyph AND a satisfied/caveat class, so the
 * satisfied state is never conveyed by color alone.
 */
export function WhyThisTrip({ reasons }: WhyThisTripProps) {
  return (
    <section className="why" aria-labelledby="why-heading">
      <h2 id="why-heading">Why this trip?</h2>
      <ul className="why__list">
        {reasons.map((r, i) => (
          <li
            key={i}
            className={`why__item why__item--${r.satisfied ? 'yes' : 'caveat'}`}
          >
            <span className="why__glyph" aria-hidden="true">
              {r.satisfied ? '✓' : '!'}
            </span>
            <div>
              <p className="why__label">
                {r.label}
                <span className="visually-hidden">
                  {r.satisfied ? ' (satisfied)' : ' (heads up)'}
                </span>
              </p>
              <p className="why__detail">{r.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
