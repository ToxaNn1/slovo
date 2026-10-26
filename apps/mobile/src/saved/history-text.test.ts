import { localDayOf, relativeTimeOf, type EntryRowModel, type HistoryEntry } from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { historyText } from './history-text';
import { count, fakeClock, strings as allStrings } from '../test-support';

const { history: strings } = allStrings;

describe('the History texts', () => {
  const time = fakeClock('2026-10-11T10:00:00+03:00');
  const text = historyText({ strings, count, clock: time.clock });
  const relative = (instant: string) =>
    text.relative(relativeTimeOf(new Date(instant), time.clock));

  it('words how long ago an Entry was Seen, on screen and for VoiceOver', () => {
    expect(relative('2026-10-11T09:59:40+03:00')).toEqual({ text: 'щойно', spoken: 'щойно' });
    expect(relative('2026-10-11T09:55:00+03:00')).toEqual({
      text: '5 хв тому',
      spoken: '5 хвилин тому',
    });
    expect(relative('2026-10-11T09:59:00+03:00').spoken).toBe('1 хвилину тому');
    expect(relative('2026-10-11T09:38:00+03:00').spoken).toBe('22 хвилини тому');
    expect(relative('2026-10-11T08:02:00+03:00')).toEqual({
      text: 'сьогодні, 08:02',
      spoken: 'сьогодні, 08:02',
    });
    expect(relative('2026-10-10T21:40:00+03:00').text).toBe('вчора, 21:40');
    expect(relative('2026-09-30T08:05:00+03:00')).toEqual({
      text: '30 вер., 08:05',
      spoken: '30 вересня, 08:05',
    });
    expect(relative('2025-12-31T12:00:00+02:00').text).toBe('31 груд. 2025, 12:00');
  });

  const heading = (instant: string) => text.dayHeading(localDayOf(new Date(instant), time.clock));

  it('heads a day «Сьогодні», «Учора» or its date, without the year in this year', () => {
    expect(heading('2026-10-11T00:10:00+03:00')).toBe('Сьогодні');
    expect(heading('2026-10-10T23:50:00+03:00')).toBe('Учора');
    expect(heading('2026-10-01T12:00:00+03:00')).toBe('1 жовтня');
    expect(heading('2025-03-08T12:00:00+02:00')).toBe('8 березня 2025');
  });

  it('follows a time-zone change of the clock', () => {
    const late = fakeClock('2026-10-11T00:30:00+03:00');
    const lateText = historyText({ strings, count, clock: late.clock });
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
          ? { kind: 'word', entryId: 'w_a', ...text, labelKey, partOfSpeech: 'noun', registers: [] }
          : labelKey === 'correction'
            ? { kind: 'correction', entryId: 'c_a', ...text, labelKey, correctionType: 'calque' }
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

  it('reads the Saved card to VoiceOver in full: the count, then each row with its age', () => {
    expect(
      text.cardLabel(312, [
        { title: 'веремія', spoken: 'щойно' },
        { title: 'брати участь', spoken: '5 хвилин тому' },
      ]),
    ).toBe('Історія, 312 записів. веремія, щойно. брати участь, 5 хвилин тому');
    expect(text.cardLabel(0, [])).toBe('Історія, 0 записів');
  });
});
