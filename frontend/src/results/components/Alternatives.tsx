import type { AlternativeDestination } from '../../agent';
import { usd } from '../format';

interface AlternativesProps {
  alternatives: AlternativeDestination[];
}

/**
 * Alternative destinations, presented as equal options with different tradeoffs — never
 * ranked best/worst. The heading and copy frame them as "other directions," and each card
 * leads with its tradeoff rather than a score.
 */
export function Alternatives({ alternatives }: AlternativesProps) {
  if (alternatives.length === 0) return null;

  return (
    <section className="alts" aria-labelledby="alts-heading">
      <h2 id="alts-heading">Other directions you could take</h2>
      <p className="alts__intro">
        Each of these is a solid trip with a different tradeoff — not better or worse, just
        a different fit.
      </p>
      <ul className="alts__grid">
        {alternatives.map((alt) => (
          <li key={alt.name} className="alt-card">
            <div
              className="alt-card__poster"
              style={{
                backgroundImage: `linear-gradient(135deg, ${alt.poster.gradient[0]}, ${alt.poster.gradient[1]})`,
              }}
              role="img"
              aria-label={`${alt.name}, ${alt.region}`}
            >
              <span aria-hidden="true">{alt.poster.emoji}</span>
            </div>
            <div className="alt-card__body">
              <h3 className="alt-card__name">{alt.name}</h3>
              <p className="alt-card__region">{alt.region}</p>
              <p className="alt-card__cost">Approx. {usd(alt.approxCostUsd)}</p>
              <p className="alt-card__explanation">{alt.explanation}</p>
              <p className="alt-card__tradeoff">
                <span className="alt-card__tradeoff-label">Tradeoff:</span> {alt.tradeoff}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
