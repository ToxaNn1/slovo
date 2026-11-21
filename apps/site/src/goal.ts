/**
 * The goal of the mission: a hundred thousand rare Words in SLOVO. The
 * count towards it is the live Words of the snapshot the site is built from.
 */
export const GOAL = 100_000;

/** A count with a space between thousands, as the design writes it: 18 342. */
export function formatCount(count: number): string {
  return String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** The share of the goal reached, as the design writes it: «1,8%». */
export function shareOfGoal(confirmed: number, target: number): string {
  return `${((confirmed / target) * 100).toFixed(1).replace('.', ',')}%`;
}

/** The width of the progress bar in per cent: the share, at least 1.5 so it shows. */
export function barWidth(confirmed: number, target: number): number {
  return Math.max((confirmed / target) * 100, 1.5);
}

/** The count shown `progress` (0 to 1) through the counting-up, easing out. */
export function countAt(confirmed: number, progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.round(confirmed * (1 - (1 - p) ** 3));
}
