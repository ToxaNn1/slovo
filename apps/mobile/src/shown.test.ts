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
  entryButtons: {
    shareCard: true,
    pronunciation: true,
    knowledge: true,
    mistakeReport: true,
  },
  stressFall: true,
  calligraphicLemma: true,
  selfCheck: false,
  selfCheckSetting: true,
  seasonalDecorSetting: true,
  shareCountersSetting: true,
  learning: true,
  stats: { streak: true, knowledge: ['word', 'correction', 'idiom', 'synonymRow', 'tip'] },
  xpBar: true,
  streakBreak: true,
  quickQuestion: true,
  sync: true,
  dailyLimit: true,
  search: true,
  moods: true,
  wordOfTheDayArchive: true,
  rarityTest: true,
};

interface Case {
  readonly off?: readonly FeatureSwitch[];
  readonly hideStreak?: boolean;
  readonly selfCheck?: boolean;
  readonly correctionsInMix?: boolean;
  readonly idiomsInMix?: boolean;
  readonly synonymRowsInMix?: boolean;
  readonly tipsInMix?: boolean;
  readonly shown: Partial<Shown>;
}

describe('what the reader is shown', () => {
  it.each<[string, Case]>([
    ['everything, with every switch on and the settings as they start', { shown: everything }],
    [
      'no Game tab with the Game off',
      { off: ['game'], shown: { tabs: ['home', 'settings', 'saved'], quickQuestion: false } },
    ],
    [
      'a still Stress mark with the falling Stress off',
      { off: ['stressAnimation'], shown: { stressFall: false } },
    ],
    [
      'the Word of the Day Lemma in the Word font with the calligraphic Lemma off',
      { off: ['calligraphy'], shown: { calligraphicLemma: false } },
    ],
    ['no Search button with Search off', { off: ['search'], shown: { search: false } }],
    [
      'no «Сезонний декор» switch with Seasonal Decor off',
      { off: ['seasonalDecor'], shown: { seasonalDecorSetting: false } },
    ],
    [
      'no «Ділитися анонімною статистикою» switch with Community Counters and Analytics off',
      { off: ['communityCounters', 'analytics'], shown: { shareCountersSetting: false } },
    ],
    [
      'the «Ділитися анонімною статистикою» switch with Analytics on alone',
      { off: ['communityCounters'], shown: { shareCountersSetting: true } },
    ],
    [
      'no «Слова дня» card with the Word of the Day archive off',
      { off: ['wordOfTheDayArchive'], shown: { wordOfTheDayArchive: false } },
    ],
    ['no Game Review with its switch off', { off: ['gameReview'], shown: { gameReview: false } }],
    [
      'no Daily Limit choice with the Daily Limit off',
      { off: ['dailyLimit'], shown: { dailyLimit: false } },
    ],
    ['no 🎲 «Слово під настрій» with moods off', { off: ['moods'], shown: { moods: false } }],
    [
      'no «Пройти тест ще раз» with the Rarity Test off',
      { off: ['rarityTest'], shown: { rarityTest: false } },
    ],
    [
      'no «Пройти тест ще раз» with the Rarity Floor it sets off',
      { off: ['rarityFloor'], shown: { rarityTest: false } },
    ],
    [
      'no Share Card button with Share Cards off',
      {
        off: ['shareCards'],
        shown: {
          entryButtons: {
            shareCard: false,
            pronunciation: true,
            knowledge: true,
            mistakeReport: true,
          },
        },
      },
    ],
    [
      'no Pronunciation button with Pronunciation off',
      {
        off: ['pronunciation'],
        shown: {
          entryButtons: {
            shareCard: true,
            pronunciation: false,
            knowledge: true,
            mistakeReport: true,
          },
        },
      },
    ],
    [
      'no mark buttons, «Вчу» or knowledge rows with Knowledge off',
      {
        off: ['knowledge'],
        shown: {
          entryButtons: {
            shareCard: true,
            pronunciation: true,
            knowledge: false,
            mistakeReport: true,
          },
          learning: false,
          stats: { streak: true, knowledge: 'none' },
        },
      },
    ],
    [
      'no «Повідомити про помилку» with Mistake Reports off',
      {
        off: ['mistakeReports'],
        shown: {
          entryButtons: {
            shareCard: true,
            pronunciation: true,
            knowledge: true,
            mistakeReport: false,
          },
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
      'the statistics without the Streak, and no XP bar, when the reader hides the counters',
      {
        hideStreak: true,
        shown: {
          stats: { streak: false, knowledge: ['word', 'correction', 'idiom', 'synonymRow', 'tip'] },
          xpBar: false,
        },
      },
    ],
    [
      'no XP bar and no Break with the XP log off',
      { off: ['xpLog'], shown: { xpBar: false, streakBreak: false } },
    ],
    ['no Break with its switch off', { off: ['streakBreak'], shown: { streakBreak: false } }],
    [
      'no Quick Question with its switch off',
      { off: ['quickQuestion'], shown: { quickQuestion: false } },
    ],
    [
      'no statistics, and so no setting to hide the Streak, with statistics off',
      { off: ['statistics'], shown: { stats: undefined } },
    ],
    // Owner decision 19.10, #478: no count of Known Corrections while the reader sees none.
    [
      'the Known Words alone with Corrections off',
      {
        off: ['corrections'],
        shown: { stats: { streak: true, knowledge: ['word', 'idiom', 'synonymRow', 'tip'] } },
      },
    ],
    [
      'the Known Words alone with the Mix without Corrections',
      {
        correctionsInMix: false,
        shown: { stats: { streak: true, knowledge: ['word', 'idiom', 'synonymRow', 'tip'] } },
      },
    ],
    // Spec #549, #565: no count of Known Idioms while the reader sees none, as with Corrections.
    [
      'no Known Idioms with Idioms off',
      {
        off: ['idioms'],
        shown: { stats: { streak: true, knowledge: ['word', 'correction', 'synonymRow', 'tip'] } },
      },
    ],
    [
      'no Known Idioms with the Mix without Idioms',
      {
        idiomsInMix: false,
        shown: { stats: { streak: true, knowledge: ['word', 'correction', 'synonymRow', 'tip'] } },
      },
    ],
    // Spec #730 story 37, #1015: Known Synonym Rows and Tips count while the reader sees them.
    [
      'no Known Synonym Rows with Synonym Rows off',
      {
        off: ['synonymRows'],
        shown: { stats: { streak: true, knowledge: ['word', 'correction', 'idiom', 'tip'] } },
      },
    ],
    [
      'no Known Synonym Rows with the Mix without Synonym Rows',
      {
        synonymRowsInMix: false,
        shown: { stats: { streak: true, knowledge: ['word', 'correction', 'idiom', 'tip'] } },
      },
    ],
    [
      'no Known Tips with Tips off',
      {
        off: ['tips'],
        shown: {
          stats: { streak: true, knowledge: ['word', 'correction', 'idiom', 'synonymRow'] },
        },
      },
    ],
    [
      'no Known Tips with the Mix without Tips',
      {
        tipsInMix: false,
        shown: {
          stats: { streak: true, knowledge: ['word', 'correction', 'idiom', 'synonymRow'] },
        },
      },
    ],
    ['no Sync status with Sync off', { off: ['sync'], shown: { sync: false } }],
  ])(
    'shows %s',
    (
      _,
      {
        off = [],
        hideStreak = false,
        selfCheck = false,
        correctionsInMix = true,
        idiomsInMix = true,
        synonymRowsInMix = true,
        tipsInMix = true,
        shown,
      },
    ) => {
      expect(
        shownOf({
          edition: editionWithout(...off),
          settings: { hideStreak, selfCheck },
          mix: {
            kinds: {
              correction: correctionsInMix,
              idiom: idiomsInMix,
              synonymRow: synonymRowsInMix,
              tip: tipsInMix,
            },
          },
        }),
      ).toEqual({ ...everything, ...shown });
    },
  );
});
