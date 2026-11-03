import type { Edition } from '../edition/edition';
import { parseDecor, type Decor } from '../edition/decor';
import type { LocalDate } from '../local-date';
import type { UserSettings } from '../settings/settings';
import { motifOf, type SeasonalMotifs } from './holiday';

/**
 * Validates an Edition's Decor and gives its seasonal motifs, or `undefined`
 * for an Edition without a motif for every Season, whose Decor stays plain
 * whatever the date (ADR 0055).
 */
export function loadSeasonalMotifs(decor: unknown): SeasonalMotifs | undefined {
  const { seasons, holidays = [] } = parseDecor(decor);
  return seasons === undefined ? undefined : { seasons, holidays };
}

/**
 * The Decor of a local date (ADR 0055). While «Сезонний декор» and its
 * `seasonalDecor` switch are both on, the Mascot wears the accessory of the
 * date's Holiday, or else of its Season; otherwise the Decor stays the
 * Edition's own. It follows the local date alone, so it changes at local
 * midnight.
 */
export function decorOf({
  decor,
  motifs,
  date,
  edition,
  settings,
}: {
  /** The Edition's plain Decor. */
  decor: Decor;
  /** The Edition's seasonal motifs, `undefined` for an Edition without them. */
  motifs: SeasonalMotifs | undefined;
  date: LocalDate;
  /** The Edition as the app runs it, with its Feature Switches in effect. */
  edition: Pick<Edition, 'isFeatureEnabled'>;
  settings: Pick<UserSettings, 'seasonalDecor'>;
}): Decor {
  if (motifs === undefined || !settings.seasonalDecor || !edition.isFeatureEnabled('seasonalDecor'))
    return decor;
  return { ...decor, mascotAccessory: motifOf(date, motifs).accessory };
}
