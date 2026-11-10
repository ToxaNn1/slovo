import { describe, expect, it } from 'vitest';

import { loadDecor } from '@slovo/core';

import { ukrainian as edition, ukrainianFolder } from './test-support';

describe('the UA Edition', () => {
  it('marks Stress, sorts with the Ukrainian alphabet and allows the apostrophe and hyphen in a Lemma, and the comma and dash in an expression', () => {
    expect(edition.languageTraits).toEqual({
      stress: { marked: true, vowels: 'а е є и і ї о у ю я'.split(' ') },
      alphabet: 'а б в г ґ д е є ж з и і ї й к л м н о п р с т у ф х ц ч ш щ ь ю я'.split(' '),
      lemmaPunctuation: ["'", '-'],
      expressionPunctuation: [',', '—'],
      sortLocale: 'uk',
      keyboard: ['й ц у к е н г ш щ з х', 'ф і в а п р о л д ж є', 'я ч с м и т ь б ю ї ґ'].map(
        (row) => row.split(' '),
      ),
    });
  });

  it('turns every Feature Switch on but the paused Seasonal Decor, calligraphy and Search button', () => {
    expect(edition.isFeatureEnabled('game')).toBe(true);
    expect(edition.isFeatureEnabled('corrections')).toBe(true);
    expect(edition.isFeatureEnabled('synonymRows')).toBe(true);
    expect(edition.isFeatureEnabled('tips')).toBe(true);
    expect(edition.isFeatureEnabled('account')).toBe(true);
    expect(edition.isFeatureEnabled('signInWithApple')).toBe(true);
    expect(edition.isFeatureEnabled('sync')).toBe(true);
    expect(edition.isFeatureEnabled('contentUpdates')).toBe(true);
    expect(edition.isFeatureEnabled('notifications')).toBe(true);
    expect(edition.isFeatureEnabled('widget')).toBe(true);
    expect(edition.isFeatureEnabled('shareCards')).toBe(true);
    expect(edition.isFeatureEnabled('pronunciation')).toBe(true);
    // Paused for the owner's test pass: the Feed's Search button.
    expect(edition.isFeatureEnabled('searchButton')).toBe(false);
    expect(edition.isFeatureEnabled('wordOfTheDay')).toBe(true);
    expect(edition.isFeatureEnabled('statistics')).toBe(true);
    expect(edition.isFeatureEnabled('knowledge')).toBe(true);
    // Off by the owner's decision: a Feed card shows everything at once.
    expect(edition.isFeatureEnabled('selfCheck')).toBe(false);
    expect(edition.isFeatureEnabled('feedTab')).toBe(true);
    expect(edition.isFeatureEnabled('rarityCeiling')).toBe(true);
    expect(edition.isFeatureEnabled('gameReview')).toBe(true);
    expect(edition.isFeatureEnabled('gameGuessWord')).toBe(true);
    expect(edition.isFeatureEnabled('gameCorrection')).toBe(true);
    expect(edition.isFeatureEnabled('gameStress')).toBe(true);
    expect(edition.isFeatureEnabled('gamePairs')).toBe(true);
    expect(edition.isFeatureEnabled('gameSurvival')).toBe(true);
    expect(edition.isFeatureEnabled('gameTimed')).toBe(true);
    expect(edition.isFeatureEnabled('gameIdiomMeaning')).toBe(true);
    expect(edition.isFeatureEnabled('gameAnglicism')).toBe(true);
    expect(edition.isFeatureEnabled('gameBuildIdiom')).toBe(true);
    expect(edition.isFeatureEnabled('gameTypeWord')).toBe(true);
    expect(edition.isFeatureEnabled('gameAnagram')).toBe(true);
    expect(edition.isFeatureEnabled('gameByLetters')).toBe(true);
    expect(edition.isFeatureEnabled('gameOrigin')).toBe(true);
    expect(edition.isFeatureEnabled('dailyCrossword')).toBe(true);
    expect(edition.isFeatureEnabled('search')).toBe(true);
    expect(edition.isFeatureEnabled('rarityTest')).toBe(true);
    expect(edition.isFeatureEnabled('weeklyRecap')).toBe(true);
    expect(edition.isFeatureEnabled('yesterday')).toBe(true);
    expect(edition.isFeatureEnabled('wordOfTheDayArchive')).toBe(true);
    expect(edition.isFeatureEnabled('activeDaysCalendar')).toBe(true);
    expect(edition.isFeatureEnabled('dailyGoal')).toBe(true);
    expect(edition.isFeatureEnabled('politePause')).toBe(true);
    expect(edition.isFeatureEnabled('firstWeek')).toBe(true);
    expect(edition.isFeatureEnabled('widgetHint')).toBe(true);
    expect(edition.isFeatureEnabled('seasonalDecor')).toBe(false);
    expect(edition.isFeatureEnabled('stressAnimation')).toBe(true);
    expect(edition.isFeatureEnabled('illustrations')).toBe(true);
    expect(edition.isFeatureEnabled('mistakeReports')).toBe(true);
    expect(edition.isFeatureEnabled('communityCounters')).toBe(true);
    expect(edition.isFeatureEnabled('communityWord')).toBe(true);
    expect(edition.isFeatureEnabled('calligraphy')).toBe(false);
    expect(edition.isFeatureEnabled('spotlight')).toBe(true);
    expect(edition.isFeatureEnabled('appIntents')).toBe(true);
    expect(edition.isFeatureEnabled('collectionLinks')).toBe(true);
    expect(edition.isFeatureEnabled('replaceOpenEntry')).toBe(true);
    expect(edition.isFeatureEnabled('analytics')).toBe(true);
  });

  it('reads Words in four Narrator Voices, Оксана by default', () => {
    expect(edition.narratorVoices.map(({ name }) => name)).toEqual([
      'Оксана',
      'Тарас',
      'Марта',
      'Остап',
    ]);
    expect(edition.narratorVoiceOf(undefined).name).toBe('Оксана');
  });

  it('starts new users on the agreed defaults', () => {
    expect(edition.userSettingDefaults).toEqual({
      theme: 'system',
      fontSize: 'M',
      vibration: true,
      notificationTimes: ['09:00', '13:00', '19:00'],
      mix: {
        categoryIds: 'all',
        correctionCategoryIds: 'all',
        kinds: { correction: true, idiom: true, synonymRow: true, tip: true },
      },
      rarityCeiling: 5,
      narratorVoice: 'oksana',
    });
  });

  it('describes every Category in one line and holds «Розстріляна лексика» alone quiet, with the board text', () => {
    const { categories, correctionCategories } = ukrainianFolder.read('config');
    const all = [...categories, ...correctionCategories];

    expect(all).toHaveLength(23);
    expect(
      all.every(({ description }) => description.length > 0 && !description.includes('\n')),
    ).toBe(true);
    expect(all.filter(({ tone }) => tone === 'quiet')).toEqual([
      expect.objectContaining({
        id: 'repressed-words',
        description: 'Слова, які вилучали зі словників у 1930-х. Повертаємо їх тихо.',
      }),
    ]);
  });

  it('draws a pictogram and a cover for every Category and Correction Category, «Розстріляна лексика» quiet', () => {
    const art = loadDecor(ukrainianFolder.read('decor')).categories ?? {};
    const { categories, correctionCategories } = ukrainianFolder.read('config');
    const ids = [...categories, ...correctionCategories].map(({ id }) => id);

    expect(Object.keys(art).toSorted()).toEqual(ids.toSorted());
    expect(art['repressed-words']?.cover).toBe('quiet');
    expect(
      Object.entries(art)
        .filter(([, { cover }]) => cover === 'quiet')
        .map(([id]) => id),
    ).toEqual(['repressed-words']);
  });
});
