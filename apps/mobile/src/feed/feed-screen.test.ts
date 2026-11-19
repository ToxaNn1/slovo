import { describe, expect, it } from 'vitest';

import { cardOnReturn } from './feed-screen';

const feed = { position: 2 };

describe('the card the Feed is told is on screen when it comes in sight', () => {
  it('is the reader’s place as the Feed keeps it when they turned no page out of sight', () => {
    expect(cardOnReturn(feed, undefined)).toBe(2);
  });

  it('is the page the reader turned to in this Feed while it was out of sight', () => {
    expect(cardOnReturn(feed, { in: feed, position: 5 })).toBe(5);
  });

  it('is the reopened Feed’s own place, not the page turned to in the Feed before it', () => {
    const reopened = { position: 4 };

    expect(cardOnReturn(reopened, { in: feed, position: 9 })).toBe(4);
  });
});
