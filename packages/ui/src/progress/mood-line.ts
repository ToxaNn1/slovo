import { fill, type EditionStrings, type Mood, type Plural } from '@slovo/contracts';

/** The days one Mood was chosen on. */
export interface MoodDays {
  readonly mood: Mood;
  readonly days: number;
}

/**
 * The row of the days by Mood of the stats sheet, e.g. «Настрої: ⚡ 3 дні · 🌿 1 день»:
 * each Mood chosen on a day, in the order given, or none before any was chosen.
 */
export function moodLine(
  strings: Pick<EditionStrings['stats'], 'moods' | 'moodDays' | 'knownJoiner'>,
  moodDays: readonly MoodDays[],
  count: (forms: Plural, count: number) => string,
): string | undefined {
  const chosen = moodDays.filter(({ days }) => days > 0);
  if (chosen.length === 0) return undefined;
  return fill(strings.moods, {
    counts: chosen
      .map(({ mood, days }) => `${mood.emoji} ${count(strings.moodDays, days)}`)
      .join(strings.knownJoiner),
  });
}
