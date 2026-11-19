/** Compact "now / 5m / 3h / 2d" label, the same steps as Orca's `formatShortTimeAgo`. A future time counts as now. */
export function shortAge(ts: number, now: number): string {
  const delta = now - ts
  if (delta < 60_000) return 'now'
  const minutes = Math.floor(delta / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/** Tooltip age label: "just now", "5m ago", "13h ago", "2d ago". */
export function longAge(ts: number, now: number): string {
  const short = shortAge(ts, now)
  return short === 'now' ? 'just now' : `${short} ago`
}
