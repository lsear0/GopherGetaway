import type { Destination } from '../../agent';
import { interestLabel } from '../../planner/summarize';
import { km, usd } from '../format';

interface DestinationCardProps {
  destination: Destination;
  durationDays: number;
  travelers: number;
  perTravelerUsd: number;
}

/**
 * The visually prominent "hero" destination card: a poster banner (gradient + emoji, or a
 * photo when a provider supplies one), the name/tagline, a stat row (total cost, per
 * traveler, duration, distance), the agent's explanation, and the key reasons it was
 * picked (matched interests). All stats have visible text labels — nothing is conveyed by
 * color or imagery alone.
 */
export function DestinationCard({
  destination,
  durationDays,
  travelers,
  perTravelerUsd,
}: DestinationCardProps) {
  const { poster } = destination;
  const bannerStyle = destination.imageUrl
    ? { backgroundImage: `url(${destination.imageUrl})` }
    : { backgroundImage: `linear-gradient(135deg, ${poster.gradient[0]}, ${poster.gradient[1]})` };

  return (
    <section className="dest-card" aria-labelledby="dest-name">
      <div className="dest-card__banner" style={bannerStyle} role="img" aria-label={`${destination.name}, ${destination.region}`}>
        {!destination.imageUrl && (
          <span className="dest-card__poster-emoji" aria-hidden="true">
            {poster.emoji}
          </span>
        )}
        <div className="dest-card__banner-overlay">
          <p className="dest-card__eyebrow">Your recommended trip</p>
          <h2 id="dest-name" className="dest-card__name">
            {destination.name}
          </h2>
          <p className="dest-card__region">{destination.region}</p>
        </div>
      </div>

      <div className="dest-card__body">
        <p className="dest-card__tagline">{destination.tagline}</p>

        <dl className="dest-card__stats">
          <div className="stat">
            <dt className="stat__label">Estimated total</dt>
            <dd className="stat__value">{usd(destination.estimatedTotalCostUsd)}</dd>
          </div>
          <div className="stat">
            <dt className="stat__label">Per traveler</dt>
            <dd className="stat__value">
              {usd(perTravelerUsd)}
              <span className="stat__sub"> × {travelers}</span>
            </dd>
          </div>
          <div className="stat">
            <dt className="stat__label">Duration</dt>
            <dd className="stat__value">
              {durationDays} {durationDays === 1 ? 'day' : 'days'}
            </dd>
          </div>
          <div className="stat">
            <dt className="stat__label">Travel distance</dt>
            <dd className="stat__value">~{km(destination.distanceKm)}</dd>
          </div>
        </dl>

        <div className="dest-card__why">
          <h3 className="dest-card__why-heading">Why I picked this</h3>
          <p>{destination.whyItFits}</p>
        </div>

        {destination.matchedInterests.length > 0 && (
          <div className="dest-card__reasons">
            <h3 className="dest-card__reasons-heading">Key reasons</h3>
            <ul className="tag-list">
              {destination.matchedInterests.map((id) => (
                <li key={id} className="tag">
                  <span aria-hidden="true">✓ </span>
                  Matches {interestLabel(id)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
