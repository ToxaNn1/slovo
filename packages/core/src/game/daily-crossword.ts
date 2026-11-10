import { openCrossingCrossword, type CrossingCrossword } from './crossing-crossword-progress';
import { openTracedCrossword, type TracedCrossword } from './traced-crossword';

/**
 * Today's Daily Crossword as its card and its screen draw it: the crossing one
 * (ADR 0087), the traced one while the crossing one is off (ADR 0073), or
 * none: on a day no pattern fills the crossing one, while the traced one
 * cannot fill its grid, or with both off.
 */
export type DailyCrosswordOpening =
  | { readonly kind: 'crossing'; readonly crossword: CrossingCrossword }
  | { readonly kind: 'traced'; readonly crossword: TracedCrossword }
  | { readonly kind: 'none' };

type Dependencies = Parameters<typeof openCrossingCrossword>[0] &
  Parameters<typeof openTracedCrossword>[0];

/** Opens today's Daily Crossword by the rule above, the crossing one first. */
export async function openDailyCrossword(
  dependencies: Dependencies,
): Promise<DailyCrosswordOpening> {
  const crossing = await openCrossingCrossword(dependencies);
  if (crossing.kind === 'open') return { kind: 'crossing', crossword: crossing.crossword };
  if (crossing.kind === 'no-fill') return { kind: 'none' };
  const traced = await openTracedCrossword(dependencies);
  return traced.kind === 'open'
    ? { kind: 'traced', crossword: traced.crossword }
    : { kind: 'none' };
}
