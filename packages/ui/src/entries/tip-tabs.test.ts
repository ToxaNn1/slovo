import type { TipCardModel } from '@slovo/core';
import { tipTabsOf } from '@slovo/ui/tip-tabs';
import { describe, expect, it } from 'vitest';

const bare: TipCardModel = {
  kind: 'tip',
  tipId: 't_hour',
  title: 'Котра година?',
  nonStandardForm: 'Скільки часу?',
  standardForm: 'Котра година?',
  explanation: 'Час не рахують, а питають, котра година.',
  example: undefined,
  sourceNames: ['Як ми говоримо'],
};

describe('tipTabsOf', () => {
  it('gives a Tip without an Example «Суть» alone, so the card draws no tab bar', () => {
    expect(tipTabsOf(bare)).toEqual([
      {
        key: 'essence',
        standardForm: 'Котра година?',
        explanation: 'Час не рахують, а питають, котра година.',
        sourceNames: ['Як ми говоримо'],
      },
    ]);
  });

  it('puts the Example of a Tip in «Приклад» after «Суть»', () => {
    const example = { text: 'Котра година, пане?', author: 'Леся Українка' };

    const tabs = tipTabsOf({ ...bare, example });

    expect(tabs.map(({ key }) => key)).toEqual(['essence', 'example']);
    expect(tabs[1]).toEqual({ key: 'example', example });
  });
});
