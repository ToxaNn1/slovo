import type { SeasonMotifs } from '@slovo/contracts';

import type { LocalDate } from '../local-date';

/** A meteorological Season, named as the Edition names its motifs. */
export type Season = keyof SeasonMotifs;

/**
 * The Season of a local date: December–February winter, March–May spring,
 * June–August summer, September–November autumn (ADR 0055). It follows the
 * local date alone, so it changes at local midnight.
 */
export function seasonOf({ month }: LocalDate): Season {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}
