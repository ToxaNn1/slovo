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
  exceptions: undefined,
  sourceNames: ['How we speak'],
};

describe('tipTabsOf', () => {
  it('gives a Tip the rule tab alone, its standard form as the one chip, so the card draws no tab bar', () => {
    expect(tipTabsOf(bare, { exceptions: true })).toEqual([
      {
        key: 'rule',
        explanation: 'Time is not counted; ask what time it is.',
        chips: ['What time is it?'],
        sourceNames: ['How we speak'],
      },
    ]);
  });

  it('adds the Example of a Tip as a chip after its standard form, with no tab of its own', () => {
    const example = { text: 'What time is it, sir?', author: 'Lesya Ukrainka' };

    const tabs = tipTabsOf({ ...bare, example }, { exceptions: true });

    expect(tabs.map(({ key }) => key)).toEqual(['rule']);
    expect(tabs[0].chips).toEqual(['What time is it?', 'What time is it, sir?']);
  });

  const exceptions = { explanation: 'Not before an o:', words: ['buryak', 'Ryazan'] };

  it('adds the tab of exceptions after the rule, their text and their words in chips', () => {
    const tabs = tipTabsOf({ ...bare, exceptions }, { exceptions: true });

    expect(tabs).toEqual([
      expect.objectContaining({ key: 'rule' }),
      { key: 'exceptions', explanation: 'Not before an o:', chips: ['buryak', 'Ryazan'] },
    ]);
  });

  it('leaves the tab of exceptions out while its Feature Switch is off', () => {
    const tabs = tipTabsOf({ ...bare, exceptions }, { exceptions: false });

    expect(tabs.map(({ key }) => key)).toEqual(['rule']);
  });
});
