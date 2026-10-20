import type { FeatureSwitch } from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { shownOf, type Shown } from './shown';

/** An Edition with the given Feature Switches off and every other on. */
function editionWithout(...off: FeatureSwitch[]) {
  return { isFeatureEnabled: (feature: FeatureSwitch) => !off.includes(feature) };
}

const everything: Shown = {
  tabs: ['home', 'settings', 'game', 'saved'],
  gameReview: true,
  entryButtons: { shareCard: true, pronunciation: true, knowledge: true },
  selfCheck: false,
  selfCheckSetting: true,
  learning: true,
  stats: { streak: true, knowledge: 'words-and-corrections' },
  sync: true,
};

interface Case {
  readonly off?: readonly FeatureSwitch[];
  readonly hideStreak?: boolean;
  readonly selfCheck?: boolean;
  readonly correctionsInMix?: boolean;
  readonly shown: Partial<Shown>;
}

describe('what the reader is shown', () => {
  it.each<[string, Case]>([
    ['everything, with every switch on and the settings as they start', { shown: everything }],
    [
      'no Game tab with the Game off',
      { off: ['game'], shown: { tabs: ['home', 'settings', 'saved'] } },
    ],
    ['no Game Review with its switch off', { off: ['gameReview'], shown: { gameReview: false } }],
    [
      'no Share Card button with Share Cards off',
      {
        off: ['shareCards'],
        shown: { entryButtons: { shareCard: false, pronunciation: true, knowledge: true } },
      },
    ],
    [
      'no Pronunciation button with Pronunciation off',
      {
        off: ['pronunciation'],
        shown: { entryButtons: { shareCard: true, pronunciation: false, knowledge: true } },
      },
    ],
    [
      'no mark buttons, «Вчу» or knowledge rows with Knowledge off',
      {
        off: ['knowledge'],
        shown: {
          entryButtons: { shareCard: true, pronunciation: true, knowledge: false },
          learning: false,
          stats: { streak: true, knowledge: 'none' },
        },
      },
    ],
    [
      'the card in Self-check once the reader turns it on',
      { selfCheck: true, shown: { selfCheck: true } },
    ],
    [
      'neither Self-check nor its setting with its switch off, whatever the reader set',
      { off: ['selfCheck'], selfCheck: true, shown: { selfCheck: false, selfCheckSetting: false } },
    ],
    [
      'the statistics without the Streak when the reader hides it',
      { hideStreak: true, shown: { stats: { streak: false, knowledge: 'words-and-corrections' } } },
    ],
    [
      'no statistics, and so no setting to hide the Streak, with statistics off',
      { off: ['statistics'], shown: { stats: undefined } },
    ],
    // Owner decision 19.10, #478: no count of Known Corrections while the reader sees none.
    [
      'the Known Words alone with Corrections off',
      { off: ['corrections'], shown: { stats: { streak: true, knowledge: 'words' } } },
    ],
    [
      'the Known Words alone with the Mix without Corrections',
      { correctionsInMix: false, shown: { stats: { streak: true, knowledge: 'words' } } },
    ],
    ['no Sync status with Sync off', { off: ['sync'], shown: { sync: false } }],
  ])(
    'shows %s',
    (_, { off = [], hideStreak = false, selfCheck = false, correctionsInMix = true, shown }) => {
      expect(
        shownOf({
          edition: editionWithout(...off),
          settings: { hideStreak, selfCheck },
          mix: { corrections: correctionsInMix },
        }),
      ).toEqual({ ...everything, ...shown });
    },
  );
});
