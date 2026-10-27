import type { FeedCard } from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { cardOnScreen, pagesOf } from './feed-screen';

const feed = { startPosition: 2 };
const inSight = { focused: true, inForeground: true, covered: false };

describe('the card the Feed is told is on screen', () => {
  it('is the card the Feed opens on until the reader turns a page', () => {
    expect(cardOnScreen({ feed, turnedTo: undefined, ...inSight })).toBe(2);
  });

  it('is the page the reader turned to in this Feed', () => {
    expect(cardOnScreen({ feed, turnedTo: { in: feed, position: 5 }, ...inSight })).toBe(5);
  });

  it('is the card a reopened Feed opens on, not the page turned to in the Feed before it', () => {
    const reopened = { startPosition: 4 };

    expect(cardOnScreen({ feed: reopened, turnedTo: { in: feed, position: 9 }, ...inSight })).toBe(
      4,
    );
  });

  it.each([
    ['Home is out of focus', { focused: false }],
    ['the app is in the background', { inForeground: false }],
    ['the onboarding covers the Feed', { covered: true }],
  ])('is none while %s', (_, out) => {
    expect(
      cardOnScreen({ feed, turnedTo: { in: feed, position: 5 }, ...inSight, ...out }),
    ).toBeUndefined();
  });
});

describe('the pages of the Feed', () => {
  const end: FeedCard = { kind: 'end-of-cycle' };
  const notice: FeedCard = {
    kind: 'notice',
    notice: 'weeklyRecap',
    day: { year: 2026, month: 10, day: 27 },
  };
  const otherEnd: FeedCard = { kind: 'end-of-cycle' };
  const cards = [end, notice, otherEnd];

  it('skip a Feed Notice the shell draws no card for yet', () => {
    expect(pagesOf(cards).pages).toEqual([end, otherEnd]);
  });

  it('give the Daily Limit card a page', () => {
    const dailyLimit: FeedCard = { ...notice, notice: 'dailyLimit' };

    expect(pagesOf([end, dailyLimit, otherEnd]).pages).toEqual([end, dailyLimit, otherEnd]);
  });

  it("map each page to the Feed's position of its card, and a page past the last on from the last card", () => {
    const { positionOf } = pagesOf(cards);

    expect([0, 1, 2].map(positionOf)).toEqual([0, 2, 3]);
  });

  it("map the Feed's position to its page, and a skipped Feed Notice to the page after it", () => {
    const { pageOf } = pagesOf(cards);

    expect([0, 1, 2, 3].map(pageOf)).toEqual([0, 1, 1, 2]);
  });
});
