import { describe, expect, it } from 'vitest';

import { cardOnScreen } from './feed-screen';

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
