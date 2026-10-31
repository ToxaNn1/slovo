import { describe, expect, it } from 'vitest';

import { parseLocalDate } from '../index';
import {
  answerKnowledge,
  isDue,
  isLearned,
  shownMark,
  type KnowledgeRecord,
} from './knowledge-record';

const day = parseLocalDate;
const monday = day('2026-10-19');

/** The record after each answer in turn, each on its own day. */
function answered(...answers: [KnowledgeRecord['mark'], string][]): KnowledgeRecord | undefined {
  return answers.reduce<KnowledgeRecord | undefined>(
    (record, [mark, date]) => answerKnowledge(record, mark, day(date)),
    undefined,
  );
}

// ADR 0043, "The interval rule".
describe('the interval rule of a Knowledge Mark', () => {
  it('makes an Entry Unknown with no earlier mark due tomorrow', () => {
    const record = answerKnowledge(undefined, 'unknown', monday);

    expect(record).toEqual({ mark: 'unknown', step: 1, reviewDay: '2026-10-20', learned: false });
    expect(isDue(record, monday)).toBe(false);
    expect(isDue(record, day('2026-10-20'))).toBe(true);
    expect(isLearned(record)).toBe(false);
  });

  it('makes an Entry Known with no earlier mark Learned at once', () => {
    const record = answerKnowledge(undefined, 'known', monday);

    expect(record).toEqual({ mark: 'known', step: null, reviewDay: null, learned: true });
    expect(isLearned(record)).toBe(true);
    expect(isDue(record, day('2027-01-01'))).toBe(false);
  });

  it('moves a Review Known from 1 to 3 days, then 7, 30 and 90, then makes the Entry Learned', () => {
    const one = answered(['unknown', '2026-10-19']);
    const three = answered(['unknown', '2026-10-19'], ['known', '2026-10-20']);
    const seven = answered(
      ['unknown', '2026-10-19'],
      ['known', '2026-10-20'],
      ['known', '2026-10-23'],
    );
    const thirty = answered(
      ['unknown', '2026-10-19'],
      ['known', '2026-10-20'],
      ['known', '2026-10-23'],
      ['known', '2026-10-30'],
    );
    const ninety = answered(
      ['unknown', '2026-10-19'],
      ['known', '2026-10-20'],
      ['known', '2026-10-23'],
      ['known', '2026-10-30'],
      ['known', '2026-11-29'],
    );
    const learned = answered(
      ['unknown', '2026-10-19'],
      ['known', '2026-10-20'],
      ['known', '2026-10-23'],
      ['known', '2026-10-30'],
      ['known', '2026-11-29'],
      ['known', '2027-02-27'],
    );

    expect(one).toMatchObject({ step: 1, reviewDay: '2026-10-20', learned: false });
    expect(three).toEqual({ mark: 'known', step: 3, reviewDay: '2026-10-23', learned: false });
    expect(seven).toEqual({ mark: 'known', step: 7, reviewDay: '2026-10-30', learned: false });
    expect(thirty).toEqual({ mark: 'known', step: 30, reviewDay: '2026-11-29', learned: false });
    expect(ninety).toEqual({ mark: 'known', step: 90, reviewDay: '2027-02-27', learned: false });
    expect(learned).toEqual({ mark: 'known', step: null, reviewDay: null, learned: true });
  });

  it('starts a Review again at 1 day on Unknown from any step, a Learned Entry too', () => {
    const fromThree = answered(
      ['unknown', '2026-10-19'],
      ['known', '2026-10-20'],
      ['unknown', '2026-10-23'],
    );
    const fromSeven = answered(
      ['unknown', '2026-10-19'],
      ['known', '2026-10-20'],
      ['known', '2026-10-23'],
      ['unknown', '2026-10-30'],
    );
    const fromLearned = answered(['known', '2026-10-19'], ['unknown', '2026-11-02']);
    const again = answered(['unknown', '2026-10-19'], ['unknown', '2026-10-20']);

    const tomorrowOf = (date: string) => ({
      mark: 'unknown',
      step: 1,
      learned: false,
      reviewDay: date,
    });
    expect(fromThree).toEqual(tomorrowOf('2026-10-24'));
    expect(fromSeven).toEqual(tomorrowOf('2026-10-31'));
    expect(fromLearned).toEqual(tomorrowOf('2026-11-03'));
    expect(again).toEqual(tomorrowOf('2026-10-21'));
  });

  it('keeps a Learned Entry Learned when it is Known again', () => {
    const learned = answerKnowledge(undefined, 'known', monday);

    expect(answerKnowledge(learned, 'known', day('2026-11-02'))).toEqual(learned);
  });

  it('counts the next Review day in local calendar days, across a month and a year', () => {
    expect(answered(['unknown', '2026-10-31'])?.reviewDay).toBe('2026-11-01');
    expect(answered(['unknown', '2026-12-30'], ['known', '2026-12-31'])?.reviewDay).toBe(
      '2027-01-03',
    );
  });

  it('keeps an Entry due on every day after its Review day until it is answered', () => {
    const record = answerKnowledge(undefined, 'unknown', monday);

    expect(isDue(record, day('2026-10-21'))).toBe(true);
    expect(isDue(record, day('2026-11-30'))).toBe(true);
    expect(isDue(undefined, monday)).toBe(false);
  });

  it('shows the mark on the card, and none while the Entry is due', () => {
    const record = answerKnowledge(undefined, 'unknown', monday);

    expect(shownMark(record, monday)).toBe('unknown');
    expect(shownMark(record, day('2026-10-20'))).toBeUndefined();
    expect(shownMark(answerKnowledge(undefined, 'known', monday), day('2027-01-01'))).toBe('known');
    expect(shownMark(undefined, monday)).toBeUndefined();
  });
});
