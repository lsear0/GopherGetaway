/** Formatting helpers shared across the results components. */

export function usd(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

/** Turn a minutes count into a friendly "1h 30m" / "45m" string. */
export function minutes(total: number): string {
  if (total <= 0) return '0m';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function km(distance: number): string {
  return `${Math.round(distance).toLocaleString()} km`;
}
