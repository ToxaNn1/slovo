import type { Word } from '@slovo/contracts';

/** The rarity a Word needs to be the site's Word of the Day. */
const WORD_OF_DAY_MIN_RARITY = 3;

const kyivDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Kyiv',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The day number of `now`'s date in Kyiv, counted from 1970-01-01. */
export function kyivDay(now: Date): number {
  const [year, month, day] = kyivDate.format(now).split('-').map(Number);
  return Math.floor(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) / 86_400_000);
}

/**
 * The site's Word of the Day, the same for every reader: the Words of rarity
 * 3 and up in id order, one a day by the date in Kyiv, round and round.
 * None when no Word is rare enough.
 */
export function wordOfDay<T extends Pick<Word, 'id' | 'rarity'>>(
  words: readonly T[],
  now: Date,
): T | undefined {
  const rare = words
    .filter((word) => word.rarity >= WORD_OF_DAY_MIN_RARITY)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  return rare[kyivDay(now) % rare.length];
}
