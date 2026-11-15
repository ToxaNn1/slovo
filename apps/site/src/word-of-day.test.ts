import { describe, expect, it } from 'vitest';

import { kyivDay, wordOfDay } from './word-of-day';

const words = [
  { id: 'w_d', rarity: 4 },
  { id: 'w_a', rarity: 3 },
  { id: 'w_b', rarity: 2 },
  { id: 'w_c', rarity: 5 },
] as const;

describe('the site Word of the Day', () => {
  it('turns over at midnight in Kyiv, summer and winter', () => {
    // 21:00 UTC is midnight in Kyiv in summer (UTC+3), 22:00 UTC in winter (UTC+2).
    expect(kyivDay(new Date('2026-07-01T21:00:00Z'))).toBe(
      kyivDay(new Date('2026-07-01T20:59:59Z')) + 1,
    );
    expect(kyivDay(new Date('2026-12-01T22:00:00Z'))).toBe(
      kyivDay(new Date('2026-12-01T21:59:59Z')) + 1,
    );
    expect(kyivDay(new Date('1970-01-01T12:00:00Z'))).toBe(0);
  });

  it('picks a Word of rarity 3 or more, one a day in id order, round and round', () => {
    const day0 = new Date('1970-01-01T12:00:00Z');
    const pick = (days: number) =>
      wordOfDay(words, new Date(day0.getTime() + days * 86_400_000))?.id;
    expect([0, 1, 2, 3, 4].map(pick)).toEqual(['w_a', 'w_c', 'w_d', 'w_a', 'w_c']);
  });

  it('is the same Word all day long for everyone', () => {
    const morning = wordOfDay(words, new Date('2026-11-15T22:30:00Z'));
    const evening = wordOfDay(words, new Date('2026-11-16T21:59:00Z'));
    expect(morning).toBeDefined();
    expect(evening).toBe(morning);
  });

  it('gives none when no Word is rare enough', () => {
    expect(wordOfDay([{ id: 'w_b', rarity: 2 }], new Date())).toBeUndefined();
  });
});
