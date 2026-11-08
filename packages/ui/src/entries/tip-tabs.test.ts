import type { TipCardModel } from '@slovo/core';
import { tipTabsOf } from '@slovo/ui/tip-tabs';
import { describe, expect, it } from 'vitest';

const bare: TipCardModel = {
  kind: 'tip',
  tipId: 't_hour',
  title: 'What time is it?',
  nonStandardForm: 'How much time?',
  standardForm: 'What time is it?',
  explanation: 'Time is not counted; ask what time it is.',
  example: undefined,
  sourceNames: ['How we speak'],
};

describe('tipTabsOf', () => {
  it('gives a Tip without an Example the essence tab alone, so the card draws no tab bar', () => {
    expect(tipTabsOf(bare)).toEqual([
      {
        key: 'essence',
        standardForm: 'What time is it?',
        explanation: 'Time is not counted; ask what time it is.',
        sourceNames: ['How we speak'],
      },
    ]);
  });

  it('puts the Example of a Tip in the example tab after the essence tab', () => {
    const example = { text: 'What time is it, sir?', author: 'Lesya Ukrainka' };

    const tabs = tipTabsOf({ ...bare, example });

    expect(tabs.map(({ key }) => key)).toEqual(['essence', 'example']);
    expect(tabs[1]).toEqual({ key: 'example', example });
  });
});
