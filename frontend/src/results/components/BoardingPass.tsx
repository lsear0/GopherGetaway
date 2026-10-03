import type { AlternativeDestination, Destination } from '../../agent';
import { interestLabel } from '../../planner/summarize';
import { usd } from '../format';

interface BoardingPassProps {
  destination: Destination;
  alternatives: AlternativeDestination[];
  budgetLimitUsd: number | null;
}

/**
 * Scored "boarding pass" recommendation cards, adapted from Verayn's travel-agent-ui.
 *
 * The top pick is shown as a boarding-pass styled card with a transparent fit score and
 * the reasons it matched; the alternatives follow as secondary scored cards. The score is
 * a budget/interest FIT signal and is explicitly labeled as such — never a safety or
 * objective-quality rating (Nupur's safety-language rule carried into the UI).
 */
export function BoardingPass({ destination, alternatives, budgetLimitUsd }: BoardingPassProps) {
  const topScore = fitScore(destination.estimatedTotalCostUsd, budgetLimitUsd, destination.matchedInterests.length);

  return (
    <section className="boarding" aria-labelledby="boarding-heading">
      <h2 id="boarding-heading">Your boarding pass</h2>

      <article className="boarding-pass" aria-labelledby="boarding-pass-name">
        <div className="boarding-pass__topline">
          <p className="boarding-pass__eyebrow">Best-fit destination</p>
          <span className="boarding-pass__status">Ready to shortlist</span>
        </div>

        <div className="boarding-pass__header">
          <div>
            <h3 id="boarding-pass-name">{destination.name}</h3>
            <p>{destination.tagline}</p>
          </div>
          <span className="boarding-pass__price">≈ {usd(destination.estimatedTotalCostUsd)} total</span>
        </div>

        <div className="boarding-pass__divider" aria-hidden="true" />

        <dl className="boarding-pass__metrics">
          <div>
            <dt>Fit score</dt>
            <dd>
              {topScore} / 100 <span className="boarding-pass__score-note">(budget &amp; interest fit)</span>
            </dd>
          </div>
          <div>
            <dt>Travel distance</dt>
            <dd>~{Math.round(destination.distanceKm).toLocaleString()} km</dd>
          </div>
          <div>
            <dt>Matched interests</dt>
            <dd>{destination.matchedInterests.length}</dd>
          </div>
        </dl>

        {destination.matchedInterests.length > 0 && (
          <ul className="boarding-pass__stamps">
            {destination.matchedInterests.map((id) => (
              <li key={id} className="boarding-pass__stamp">
                {interestLabel(id)}
              </li>
            ))}
          </ul>
        )}
      </article>

      {alternatives.length > 0 && (
        <div className="boarding__alts">
          {alternatives.map((alt) => {
            const score = fitScore(alt.approxCostUsd, budgetLimitUsd, 0);
            return (
              <article key={alt.name} className="boarding-pass boarding-pass--secondary">
                <div className="boarding-pass__header">
                  <div>
                    <h3>{alt.name}</h3>
                    <p>{alt.region}</p>
                  </div>
                  <span className="boarding-pass__price boarding-pass__price--secondary">
                    ≈ {usd(alt.approxCostUsd)}
                  </span>
                </div>
                <p className="boarding-pass__score-note">Fit score {score} / 100 · {alt.tradeoff}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

/**
 * Transparent, deterministic fit score (0–100): budget headroom + interest matches.
 * This is a UI-side ranking signal, not a quality or safety measure.
 */
function fitScore(costUsd: number, budgetLimitUsd: number | null, matchedInterests: number): number {
  let score = 50;
  if (budgetLimitUsd && budgetLimitUsd > 0) {
    const ratio = costUsd / budgetLimitUsd;
    if (ratio <= 0.75) score += 30;
    else if (ratio <= 1) score += 18;
    else if (ratio <= 1.1) score += 4;
    else score -= 20;
  }
  score += Math.min(matchedInterests * 6, 20);
  return Math.max(0, Math.min(100, Math.round(score)));
}
