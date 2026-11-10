import { PREFETCH_CARDS } from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { wordIdsAhead, type CardAhead } from './feed-ahead';

const word = (wordId: string): CardAhead => ({ kind: 'word', model: { wordId } });

describe('the Words the Feed downloads the media of ahead', () => {
  it('are the Words of the cards after the card on screen', () => {
    const cards = [word('a'), word('b'), word('c'), word('d')];

    expect(wordIdsAhead(cards, 1)).toEqual(['c', 'd']);
  });

  it('skip the cards that are no Word', () => {
    const cards: CardAhead[] = [
      word('a'),
      { kind: 'notice' },
      word('b'),
      { kind: 'idiom' },
      { kind: 'quick-question' },
      word('c'),
    ];

    expect(wordIdsAhead(cards, 0)).toEqual(['b', 'c']);
  });

  it('reach only as far as the cards ahead the prefetch takes, Words or not', () => {
    const cards: CardAhead[] = [
      word('on screen'),
      ...Array.from({ length: PREFETCH_CARDS - 1 }, () => ({ kind: 'notice' as const })),
      word('last ahead'),
      word('too far'),
    ];

    expect(wordIdsAhead(cards, 0)).toEqual(['last ahead']);
  });

  it('are none on the last card', () => {
    expect(wordIdsAhead([word('a'), word('b')], 1)).toEqual([]);
  });
});
