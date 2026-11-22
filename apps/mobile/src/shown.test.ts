import type { FeatureSwitch } from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { shownOf, type Shown } from './shown';

/**
 * An Edition with the given Feature Switches off and every other on. Each
 * case turns off a feature's own switch: what a feature's switch depends on
 * is the Edition's rule in the Core, tested there.
 */
function editionWithout(...off: FeatureSwitch[]) {
  return { isFeatureEnabled: (feature: FeatureSwitch) => !off.includes(feature) };
}

const everything: Shown = {
  tabs: ['home', 'game', 'mix', 'saved', 'settings'],
  mixPlace: 'tab',
  selfCheck: false,
  shareCountersSetting: true,
  stats: { streak: true, knowledge: ['word', 'correction', 'idiom', 'synonymRow', 'tip'] },
  xpBar: true,
  celebrations: true,
  levelLadder: true,
  breakCard: true,
  streakFreezeCard: true,
  badgeCounts: true,
  progressShareCards: true,
  questionnaire: { levelWhy: true, selfRating: true, interests: true },
};

interface Case {
  readonly off?: readonly FeatureSwitch[];
  readonly noCounters?: boolean;
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
      {
        off: ['game'],
        shown: { tabs: ['home', 'mix', 'saved', 'settings'] },
      },
    ],
    [
      'the four tabs of before, no «Мікс», and the texts sending to Settings, with the mixTab switch off (ADR 0201)',
      {
        off: ['mixTab'],
        shown: { tabs: ['home', 'game', 'saved', 'settings'], mixPlace: 'settings' },
      },
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
      'no «Пройти тест ще раз» and no self-rating with the Rarity Test off',
      {
        off: ['rarityTest'],
        shown: {
          questionnaire: { levelWhy: true, selfRating: false, interests: true },
        },
      },
    ],
    [
      'the self-rating alone in «Анкета: підлаштувати Стрічку» with the questionnaire off',
      {
        off: ['questionnaire'],
        shown: { questionnaire: { levelWhy: false, selfRating: true, interests: true } },
      },
    ],
    [
      'no interests in «Анкета: підлаштувати Стрічку» with «Що тобі цікаво?» off',
      {
        off: ['interestsQuestion'],
        shown: { questionnaire: { levelWhy: true, selfRating: true, interests: false } },
      },
    ],
    [
      'the interests alone in «Анкета: підлаштувати Стрічку» with the questionnaire and the Rarity Test off',
      {
        off: ['questionnaire', 'rarityTest'],
        shown: {
          questionnaire: { levelWhy: false, selfRating: false, interests: true },
        },
      },
    ],
    [
      'no «Анкета: підлаштувати Стрічку» with its three questions off',
      {
        off: ['questionnaire', 'rarityTest', 'interestsQuestion'],
        shown: { questionnaire: undefined },
      },
    ],
    [
      'no mark buttons, «Вчу» or knowledge rows with Knowledge off',
      {
        off: ['knowledge'],
        shown: {
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
      { off: ['selfCheck'], selfCheck: true, shown: { selfCheck: false } },
    ],
    [
      'the statistics without the Streak, no XP bar and no celebrations, when the reader hides the counters',
      {
        noCounters: true,
        shown: {
          stats: { streak: false, knowledge: ['word', 'correction', 'idiom', 'synonymRow', 'tip'] },
          xpBar: false,
          celebrations: false,
          levelLadder: false,
          streakFreezeCard: false,
          breakCard: false,
          badgeCounts: false,
          progressShareCards: false,
        },
      },
    ],
    [
      'no XP bar and no celebrations with the XP log off',
      { off: ['xpLog'], shown: { xpBar: false, celebrations: false } },
    ],
    [
      'no Level ladder with its switch off',
      { off: ['levelLadder'], shown: { levelLadder: false } },
    ],
    ['no Break card with its switch off', { off: ['breakCard'], shown: { breakCard: false } }],
    [
      'no Streak freeze card with its switch off',
      { off: ['streakFreezeCard'], shown: { streakFreezeCard: false } },
    ],
    [
      'no Streak freeze card with the freezes off',
      { off: ['streakFreezes'], shown: { streakFreezeCard: false } },
    ],
    [
      'no progress Share Cards with their switch off',
      { off: ['progressShareCards'], shown: { progressShareCards: false } },
    ],
    [
      'no statistics, with statistics off, and still «Без лічильників» for the XP bar',
      { off: ['statistics'], shown: { stats: undefined } },
    ],
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
  ])(
    'shows %s',
    (
      _,
      {
        off = [],
        noCounters = false,
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
          settings: { noCounters, selfCheck },
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
