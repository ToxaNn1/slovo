import { knownLine } from '@slovo/ui/known-line';
import { describe, expect, it } from 'vitest';

import { count, strings } from './test-support';

const line = (
  kinds: Parameters<typeof knownLine>[2],
  word: number,
  correction: number,
  idiom: number,
  synonymRow = 0,
  tip = 0,
) => knownLine(strings.stats, { word, correction, idiom, synonymRow, tip }, kinds, count);

// Spec #461, #549, #730, ADR 0020: the row of the Known Entries of the stats sheet, in the plural forms of Ukrainian.
describe('the row of the Known Entries, in the Ukrainian Edition', () => {
  it('names the Known Words alone while Corrections and Idioms are left out', () => {
    expect(line(['word'], 12, 3, 8)).toBe('Знаю 12 слів');
    expect(line(['word'], 1, 3, 8)).toBe('Знаю 1 слово');
  });

  it('names the Known Corrections after the Known Words', () => {
    expect(line(['word', 'correction'], 12, 3, 8)).toBe('Знаю 12 слів · 3 Виправлення');
    expect(line(['word', 'correction'], 2, 5, 8)).toBe('Знаю 2 слова · 5 Виправлень');
  });

  it('names the Known Idioms after the Known Corrections', () => {
    expect(line(['word', 'correction', 'idiom'], 120, 12, 8)).toBe(
      'Знаю 120 слів · 12 Виправлень · 8 фразеологізмів',
    );
    expect(line(['word', 'correction', 'idiom'], 21, 22, 23)).toBe(
      'Знаю 21 слово · 22 Виправлення · 23 фразеологізми',
    );
  });

  it('names the Known Idioms after the Known Words while Corrections are left out', () => {
    expect(line(['word', 'idiom'], 12, 3, 1)).toBe('Знаю 12 слів · 1 фразеологізм');
    expect(line(['word', 'idiom'], 0, 3, 0)).toBe('Знаю 0 слів · 0 фразеологізмів');
  });

  // Spec #730 story 37, #1015: the Known Synonym Rows and Tips last.
  it('names the Known Synonym Rows and Tips after the Known Idioms', () => {
    const all = ['word', 'correction', 'idiom', 'synonymRow', 'tip'] as const;
    expect(line(all, 120, 15, 8, 5, 3)).toBe(
      'Знаю 120 слів · 15 Виправлень · 8 фразеологізмів · 5 синонімічних рядів · 3 поради',
    );
    expect(line(all, 1, 1, 1, 1, 1)).toBe(
      'Знаю 1 слово · 1 Виправлення · 1 фразеологізм · 1 синонімічний ряд · 1 порада',
    );
    expect(line(all, 2, 2, 2, 2, 2)).toBe(
      'Знаю 2 слова · 2 Виправлення · 2 фразеологізми · 2 синонімічні ряди · 2 поради',
    );
    expect(line(['word', 'tip'], 0, 0, 0, 0, 25)).toBe('Знаю 0 слів · 25 порад');
  });
});
