/**
 * The goal of the mission: a million confirmed Entries (ADR 0071).
 * PLACEHOLDER: `confirmed` is a demo number until the live count from
 * Analytics exists (ADR 0068).
 */
export const goal = { confirmed: 48317, target: 1_000_000 } as const;

/** A count with a space between thousands, as the design writes it: 48 317. */
export function formatCount(count: number): string {
  return String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** The share of the goal reached, in Ukrainian notation: «4,8 %». */
export function shareOfGoal(confirmed: number, target: number): string {
  return `${((confirmed / target) * 100).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} %`;
}

/** The count shown `progress` (0 to 1) through the counting-up, easing out. */
export function countAt(confirmed: number, progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.round(confirmed * (1 - (1 - p) ** 3));
}

/**
 * The count as the board's cells: one digit per cell, padded with zeros to the
 * width of the final count, `null` where the final count has a space.
 */
export function boardCells(shown: number, confirmed: number): (string | null)[] {
  const full = formatCount(confirmed);
  const text = formatCount(shown).padStart(full.length, ' ');
  return Array.from(full, (ch, i) =>
    ch === ' ' ? null : text[i] === ' ' ? '0' : (text[i] ?? '0'),
  );
}
