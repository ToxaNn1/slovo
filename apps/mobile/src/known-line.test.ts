import { knownLine } from '@slovo/ui/known-line';
import { describe, expect, it } from 'vitest';

import { count, strings } from './test-support';

const line = (
  kinds: Parameters<typeof knownLine>[2],
  word: number,
  correction: number,
  idiom: number,
) => knownLine(strings.stats, { word, correction, idiom }, kinds, count);

// Spec #461, #549, ADR 0020: the row of the Known Entries of the stats sheet, in the plural forms of Ukrainian.
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
});
