import { localDayOf, type EntryRowModel, type HistoryEntry } from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { historyText } from './history-text';
import { fakeClock, strings as allStrings } from '../test-support';

const { history: strings, dates } = allStrings;

describe('the History texts', () => {
  const time = fakeClock('2026-10-11T10:00:00+03:00');
  const text = historyText({ strings, dates, clock: time.clock });
  const heading = (instant: string) => text.dayHeading(localDayOf(new Date(instant), time.clock));

  it('heads a day «Сьогодні», «Учора» or its date, without the year in this year', () => {
    expect(heading('2026-10-11T00:10:00+03:00')).toBe('Сьогодні');
    expect(heading('2026-10-10T23:50:00+03:00')).toBe('Учора');
    expect(heading('2026-10-01T12:00:00+03:00')).toBe('1 жовтня');
    expect(heading('2025-03-08T12:00:00+02:00')).toBe('8 березня 2025');
  });

  it('follows a time-zone change of the clock', () => {
    const late = fakeClock('2026-10-11T00:30:00+03:00');
    const lateText = historyText({ strings, dates, clock: late.clock });
    const headingOf = () =>
      lateText.dayHeading(localDayOf(new Date('2026-10-10T23:50:00+03:00'), late.clock));
    expect(headingOf()).toBe('Учора');

    late.moveTo('Europe/London');
    expect(headingOf()).toBe('Сьогодні');
  });

  it('labels a row by its kind, or an Idiom by its Idiom Type', () => {
    const entry = (
      labelKey: EntryRowModel['labelKey'],
      wordOfTheDay = false,
    ): Pick<HistoryEntry, 'row' | 'wordOfTheDay'> => {
      const text = { title: 'a', secondLine: 'b', spoken: 'a, b' };
      const row: EntryRowModel =
        labelKey === 'word'
          ? {
              kind: 'word',
              entryId: 'w_a',
              ...text,
              labelKey,
              partOfSpeech: 'noun',
              gender: undefined,
              registers: [],
              rarity: 3,
            }
          : labelKey === 'correction'
            ? {
                kind: 'correction',
                entryId: 'c_a',
                ...text,
                labelKey,
                correctionType: 'calque',
                standardForms: ['a'],
              }
            : labelKey === 'synonymRow' || labelKey === 'tip'
              ? { kind: labelKey, entryId: 'r_a', ...text, labelKey }
              : { kind: 'idiom', entryId: 'i_a', ...text, labelKey };
      return { wordOfTheDay, row };
    };

    expect(text.label(entry('word'))).toBe('слово');
    expect(text.label(entry('correction'))).toBe('виправлення');
    expect(text.label(entry('idiom'))).toBe('фразеологізм');
    expect(text.label(entry('placeName'))).toBe('топонім');
    expect(text.label(entry('proverb'))).toBe('прислів’я');
    expect(text.label(entry('synonymRow'))).toBe('синоніми');
    expect(text.label(entry('tip'))).toBe('порада');
    expect(text.label(entry('word', true))).toBe('слово дня');
  });
});
