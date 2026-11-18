import { openCrossingCrossword, type CrossingCrossword } from './crossing-crossword-progress';

/**
 * Today's Daily Crossword as its card and its screen draw it: the crossing one
 * (ADR 0087), or none on a day no pattern fills it or while `dailyCrossword`
 * is off; no older crossword takes its place (ADR 0176).
 */
export type DailyCrosswordOpening =
  { readonly kind: 'crossing'; readonly crossword: CrossingCrossword } | { readonly kind: 'none' };

/** Opens today's Daily Crossword by the rule above. */
export async function openDailyCrossword(
  dependencies: Parameters<typeof openCrossingCrossword>[0],
): Promise<DailyCrosswordOpening> {
  const crossing = await openCrossingCrossword(dependencies);
  return crossing.kind === 'open'
    ? { kind: 'crossing', crossword: crossing.crossword }
    : { kind: 'none' };
}
