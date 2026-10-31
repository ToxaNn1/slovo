import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  COLLECTION_LINK_SIZE,
  EditionConfigSchema,
  EditionDecorSchema,
  EditionStringsSchema,
  EditionTokensSchema,
  fill,
  PluralLabelSchema,
  PluralSchema,
  SplashDecorSchema,
  type ColorTokens,
} from '@slovo/contracts';
import { loadEdition } from '@slovo/core';
import {
  EDITIONS_DIR,
  listEditions,
  openEdition,
  type EditionJsonFile,
} from '@slovo/language-pack/edition';
import { coreTokens } from '@slovo/ui/tokens';
import { describe, expect, it } from 'vitest';

const editions = listEditions(EDITIONS_DIR);
const pathOf = (edition: string, file: EditionJsonFile) =>
  openEdition(EDITIONS_DIR, edition).path(file);

/** A JSON file of an Edition, parsed and not yet checked. */
function readJson(edition: string, file: EditionJsonFile): unknown {
  return JSON.parse(readFileSync(pathOf(edition, file), 'utf8'));
}

/** Whether an Edition brings a file it may leave out. */
const has = (edition: string, file: EditionJsonFile) => existsSync(pathOf(edition, file));

// The Language Pack build reads neither the UI strings nor the design tokens,
// so the shell checks them here.
describe('Edition UI strings', () => {
  it.each(editions)('the %s Edition has every UI string the shell needs', (edition) => {
    expect(EditionStringsSchema.safeParse(readJson(edition, 'strings')).error).toBeUndefined();
  });

  // The contracts require only `other`, since the forms differ by language
  // (ADR 0020), so a missing form of the Edition's language is caught here.
  it.each(editions)('the %s Edition gives every count the plural forms its language has', (id) => {
    const edition = openEdition(EDITIONS_DIR, id);
    const categories = new Intl.PluralRules(edition.config.locale).resolvedOptions()
      .pluralCategories;
    const counts = pluralsOf(edition.read('strings'));

    expect(counts.length).toBeGreaterThan(0);
    for (const forms of counts) expect(Object.keys(forms).sort()).toEqual([...categories].sort());
  });
});

describe('the 0.4 UI strings groups', () => {
  const groups = ['stats', 'onboarding', 'notifications', 'notificationBody'] as const;
  const strings = readJson('uk', 'strings') as Record<string, unknown>;

  it.each(groups)('the Ukrainian Edition needs the %s group', (group) => {
    const without = Object.fromEntries(Object.entries(strings).filter(([key]) => key !== group));

    const result = EditionStringsSchema.safeParse(without);

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(group);
  });
});

describe('the 0.5 UI strings group', () => {
  const strings = readJson('uk', 'strings') as Record<string, unknown>;

  it('the Ukrainian Edition needs the game group', () => {
    const without = Object.fromEntries(Object.entries(strings).filter(([key]) => key !== 'game'));

    const result = EditionStringsSchema.safeParse(without);

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('game');
  });

  /** The strings group without the key. */
  const without = (group: unknown, key: string) =>
    Object.fromEntries(
      Object.entries(group as Record<string, unknown>).filter(([name]) => name !== key),
    );
  const game = strings['game'] as Record<string, unknown>;

  it.each([
    [
      'game.result.best',
      { ...strings, game: { ...game, result: without(game['result'], 'best') } },
    ],
    ['stats.gameBest', { ...strings, stats: without(strings['stats'], 'gameBest') }],
    ['stats.gameBestLabel', { ...strings, stats: without(strings['stats'], 'gameBestLabel') }],
  ])('the Ukrainian Edition needs %s, the best result', (path, stringsWithout) => {
    const result = EditionStringsSchema.safeParse(stringsWithout);

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(path);
  });
});

describe('the 0.8.12 Game strings', () => {
  const strings = readJson('uk', 'strings') as Record<string, unknown>;
  const game = strings['game'] as Record<string, unknown>;
  /** The strings with the Game's texts changed. */
  const withGame = (changed: Record<string, unknown>) => ({
    ...strings,
    game: { ...game, ...changed },
  });
  /** The issues the strings schema finds, as paths. */
  const issuesOf = (changed: unknown) =>
    EditionStringsSchema.safeParse(changed).error?.issues.map((issue) => issue.path.join('.'));
  const parsed = EditionStringsSchema.parse(strings).game;

  it('the Ukrainian Edition carries the agreed texts verbatim', () => {
    expect(parsed.groups).toEqual({
      words: 'Слова',
      corrections: 'Виправлення',
      idioms: 'Вислови',
      challenge: 'Виклик',
    });
    expect(parsed.modeBest).toEqual({
      outOf: 'Найкраще: {n} з {total}',
      count: 'Найкраще: {n}',
    });
    expect(parsed.openLetter).toBe('Відкрити літеру');
    expect(parsed.dailyCrossword).toMatchObject({
      title: 'Кросворд дня',
      start: 'Почати',
      resume: 'Продовжити',
      solved: 'Розв’язано!',
    });
  });

  it('the Ukrainian Edition names every mode as agreed', () => {
    expect(
      Object.fromEntries(Object.entries(parsed.modes).map(([id, mode]) => [id, mode.title])),
    ).toEqual({
      'guess-word': 'Вгадай слово',
      stress: 'Наголос',
      pairs: 'Пари',
      anagram: 'Анаграми',
      'by-letters': 'За буквами',
      'type-word': 'Впиши слово',
      origin: 'Звідки слово',
      correction: 'Обери правильне',
      anglicism: 'Англіцизми',
      'idiom-meaning': 'Фразеологізми',
      'build-idiom': 'Склади вислів',
      survival: 'Виживання',
      timed: 'На час',
    });
  });

  it.each(['groups', 'modeBest', 'openLetter', 'dailyCrossword', 'letters'])(
    'the Ukrainian Edition needs game.%s',
    (key) => {
      const without = Object.fromEntries(Object.entries(game).filter(([name]) => name !== key));

      expect(issuesOf({ ...strings, game: without })).toEqual([`game.${key}`]);
    },
  );

  it.each([
    ['modeBest.outOf', { modeBest: { outOf: 'Найкраще: {n}', count: 'Найкраще: {n}' } }],
    ['modeBest.count', { modeBest: { outOf: 'Найкраще: {n} з {total}', count: 'Найкраще' } }],
    [
      'dailyCrossword.dated',
      { dailyCrossword: { ...(game['dailyCrossword'] as object), dated: 'Кросворд дня' } },
    ],
    [
      'dailyCrossword.cellLabel',
      {
        dailyCrossword: {
          ...(game['dailyCrossword'] as object),
          cellLabel: '{cell}. {clue}. Рядок {row}',
        },
      },
    ],
    ['letters.label', { letters: { ...(game['letters'] as object), label: '{letter}, літера' } }],
    ['letters.empty', { letters: { ...(game['letters'] as object), empty: 'порожня' } }],
  ])('needs the placeholders of game.%s', (path, changed) => {
    expect(issuesOf(withGame(changed))).toEqual([`game.${path}`]);
  });

  it('needs the seconds left in every form of the timer VoiceOver reads', () => {
    const round = game['round'] as Record<string, unknown>;
    const timer = { ...(round['timer'] as object), many: 'лишилось мало секунд' };

    expect(issuesOf(withGame({ round: { ...round, timer } }))).toEqual(['game.round.timer.many']);
  });

  it('names a place for every letter of the longest Word as VoiceOver reads it', () => {
    expect(parsed.letters.ordinals.length).toBeGreaterThanOrEqual(15);
    expect(parsed.letters.ordinals.slice(0, 3)).toEqual(['перша', 'друга', 'третя']);
  });
});

describe('the 0.8.13 strings', () => {
  const strings = readJson('uk', 'strings') as Record<string, Record<string, unknown>>;
  /** The issues the strings schema finds, as paths. */
  const issuesOf = (changed: unknown) =>
    EditionStringsSchema.safeParse(changed).error?.issues.map((issue) => issue.path.join('.'));
  const parsed = EditionStringsSchema.parse(strings);

  it('the Ukrainian Edition carries the agreed Search texts verbatim', () => {
    expect(parsed.search).toMatchObject({
      title: 'Пошук',
      clear: 'Очистити',
      groups: {
        words: 'Слова',
        corrections: 'Виправлення',
        idioms: 'Вислови',
        synonymRows: 'Синоніми',
        tips: 'Поради',
        byMeaning: 'За значенням',
      },
      nothingFound: 'Нічого не знайдено',
    });
  });

  it('the Ukrainian Edition carries the agreed Rarity Test texts verbatim', () => {
    expect(parsed.rarityTest).toMatchObject({
      start: 'Перевірити рівень',
      subtitle: '10 слів — і ми підберемо рідкість саме для вас',
      progress: '{n} з {total}',
      retake: 'Пройти тест ще раз',
      result: 'Ваш рівень: від {n}',
    });
    expect(parsed.knowledge).toMatchObject({ known: 'Знаю', unknown: 'Не знаю' });
  });

  it('the Ukrainian Edition carries the agreed Feed Notice texts verbatim', () => {
    expect(parsed.feedNotices).toMatchObject({
      weeklyRecap: {
        title: 'Ваш тиждень',
        seen: 'переглянуто',
        saved: 'збережено',
        known: 'знаю',
        streak: 'серія',
      },
      yesterday: { title: 'Пам’ятаєте вчорашнє слово?' },
      dailyLimit: { message: 'На сьогодні досить. Повертайтеся завтра', keepGoing: 'Гортати далі' },
      firstWeek: { close: 'Зрозуміло', lastDayTitle: 'Тиждень із нами' },
    });
  });

  it('the Ukrainian Edition carries a first-week card with a title and a text for days 1 to 6', () => {
    const { days } = parsed.feedNotices.firstWeek;

    expect(days).toHaveLength(6);
    for (const day of days) {
      expect(day.title).not.toBe('');
      expect(day.text).not.toBe('');
    }
  });

  it('needs six first-week cards before the seventh day', () => {
    const feedNotices = strings['feedNotices'] as { firstWeek: { days: unknown[] } };
    const changed = {
      ...strings,
      feedNotices: {
        ...feedNotices,
        firstWeek: { ...feedNotices.firstWeek, days: feedNotices.firstWeek.days.slice(0, 5) },
      },
    };

    expect(issuesOf(changed)).toEqual(['feedNotices.firstWeek.days']);
  });

  it('needs a seventh day’s text without the Streak, for a reader who hides it', () => {
    const feedNotices = strings['feedNotices'] as { firstWeek: Record<string, unknown> };
    const firstWeek = Object.fromEntries(
      Object.entries(feedNotices.firstWeek).filter(([name]) => name !== 'lastDayTextNoStreak'),
    );

    expect(parsed.feedNotices.firstWeek.lastDayTextNoStreak).not.toBe('');
    expect(issuesOf({ ...strings, feedNotices: { ...feedNotices, firstWeek } })).toEqual([
      'feedNotices.firstWeek.lastDayTextNoStreak',
    ]);
  });

  it('needs the Streak as {count} in every form of the seventh day’s text', () => {
    const feedNotices = strings['feedNotices'] as { firstWeek: { lastDayText: object } };
    const changed = {
      ...strings,
      feedNotices: {
        ...feedNotices,
        firstWeek: {
          ...feedNotices.firstWeek,
          lastDayText: { ...feedNotices.firstWeek.lastDayText, few: 'Ваша серія — кілька днів.' },
        },
      },
    };

    expect(issuesOf(changed)).toEqual(['feedNotices.firstWeek.lastDayText.few']);
  });

  it('the Ukrainian Edition carries the agreed texts of Settings, «Збережене», Mood and the widget', () => {
    expect(parsed.settings.dailyLimit).toEqual({ title: 'Ліміт на день', off: 'Вимк.' });
    expect(parsed.wordOfTheDayArchive.title).toBe('Слова дня');
    expect(parsed.mood.title).toBe('Слово під настрій');
    expect(parsed.settings.howToAddWidget).toBe('Як додати віджет');
  });

  it.each(['search', 'rarityTest', 'feedNotices', 'wordOfTheDayArchive', 'mood'])(
    'every Edition needs %s',
    (key) => {
      const without = Object.fromEntries(Object.entries(strings).filter(([name]) => name !== key));

      expect(issuesOf(without)).toEqual([key]);
    },
  );

  it.each([
    ['rarityTest.result', { rarityTest: { ...strings['rarityTest'], result: 'Ваш рівень' } }],
    ['rarityTest.progress', { rarityTest: { ...strings['rarityTest'], progress: '{n} з 10' } }],
    ['search.resultLabel', { search: { ...strings['search'], resultLabel: '{kind}' } }],
  ])('needs every placeholder in %s', (path, changed) => {
    expect(issuesOf({ ...strings, ...changed })).toEqual([path]);
  });

  describe('notification templates', () => {
    const templates = strings['notificationTemplates'] as { titles: string[]; farewell: string };
    const withTemplates = (changed: Partial<typeof templates>) =>
      issuesOf({ ...strings, notificationTemplates: { ...templates, ...changed } });

    it('the Ukrainian Edition carries 10 title templates, each with {word}, and a farewell text', () => {
      expect(parsed.notificationTemplates.titles).toHaveLength(10);
      for (const title of parsed.notificationTemplates.titles) expect(title).toContain('{word}');
      expect(parsed.notificationTemplates.farewell).not.toBe('');
    });

    it('every Edition needs the templates and the farewell text', () => {
      const without = Object.fromEntries(
        Object.entries(strings).filter(([name]) => name !== 'notificationTemplates'),
      );

      expect(issuesOf(without)).toEqual(['notificationTemplates']);
      expect(withTemplates({ farewell: '' })).toEqual(['notificationTemplates.farewell']);
    });

    it.each([9, 11])('refuses %i title templates', (count) => {
      const titles = Array.from({ length: count }, (_, index) => `{word} ${String(index)}`);

      expect(withTemplates({ titles })).toEqual(['notificationTemplates.titles']);
    });

    it('refuses a title template without {word}', () => {
      const titles = templates.titles.with(3, 'Слово дня');

      expect(withTemplates({ titles })).toEqual(['notificationTemplates.titles.3']);
    });
  });
});

describe('the 0.8.14 strings', () => {
  const strings = readJson('uk', 'strings') as Record<string, Record<string, unknown>>;
  const issuesOf = (changed: unknown) =>
    EditionStringsSchema.safeParse(changed).error?.issues.map((issue) => issue.path.join('.'));
  const parsed = EditionStringsSchema.parse(strings);
  const pluralRules = new Intl.PluralRules('uk');
  /** A count text as the app fills it: the form of `count`, then the other placeholders. */
  const countText = (forms: Record<string, string | undefined>, count: number, values = {}) =>
    fill(forms[pluralRules.select(count)] ?? forms['other'] ?? '', {
      count: String(count),
      ...values,
    });

  it('the Ukrainian Edition carries the agreed Mistake Report texts verbatim', () => {
    expect(parsed.mistakeReport).toEqual({
      action: 'Повідомити про помилку',
      types: {
        typo: 'Друкарська помилка',
        stress: 'Наголос',
        definition: 'Визначення',
        other: 'Інше',
      },
      comment: 'Коментар (необов’язково)',
      send: 'Надіслати',
      sent: 'Дякуємо! Ми перевіримо.',
      tooMany: 'Забагато повідомлень сьогодні. Спробуйте завтра.',
      failed: 'Не вдалося надіслати. Спробуйте ще раз.',
    });
  });

  it('the Ukrainian Edition carries the agreed Settings texts verbatim, with an explanation under each', () => {
    expect(parsed.settings.seasonalDecor.title).toBe('Сезонний декор');
    expect(parsed.settings.seasonalDecor.explanation).not.toBe('');
    expect(parsed.settings.anonymousStats).toEqual({
      title: 'Ділитися анонімною статистикою',
      explanation:
        'Лише анонімні лічильники: скільки читачів знають і зберегли слово. Без акаунта й без даних пристрою.',
    });
  });

  it('the Ukrainian Edition carries the agreed Community Word and Illustration texts verbatim', () => {
    expect(parsed.feedNotices.communityWord.title).toBe('Слово тижня спільноти');
    expect(parsed.wordCard.illustration).toBe('Ілюстрація до слова {lemma}');
  });

  it.each([
    [1, 'Знають 1 з 1 читача · зберегли 0'],
    [2, 'Знають 1 з 2 читачів · зберегли 0'],
    [5, 'Знають 1 з 5 читачів · зберегли 0'],
    [21, 'Знають 1 з 21 читача · зберегли 0'],
  ])('the Ukrainian counter line of %i readers reads «%s»', (total, line) => {
    const counters = parsed.knowledge.communityCounters;

    expect(
      fill(counters.line, {
        known: countText(counters.known, total, { known: '1' }),
        saved: fill(counters.saved, { saved: '0' }),
      }),
    ).toBe(line);
  });

  it.each([
    [1, 'додав 1 читач'],
    [2, 'додали 2 читачі'],
    [5, 'додали 5 читачів'],
    [12, 'додали 12 читачів'],
    [21, 'додав 21 читач'],
  ])('the Ukrainian Community Word of %i readers reads «%s»', (count, text) => {
    expect(countText(parsed.feedNotices.communityWord.added, count)).toBe(text);
  });

  it.each(['mistakeReport'])('every Edition needs %s', (key) => {
    const without = Object.fromEntries(Object.entries(strings).filter(([name]) => name !== key));

    expect(issuesOf(without)).toEqual([key]);
  });

  it.each([
    ['settings', 'seasonalDecor'],
    ['settings', 'anonymousStats'],
    ['knowledge', 'communityCounters'],
    ['feedNotices', 'communityWord'],
    ['wordCard', 'illustration'],
  ])('every Edition needs %s.%s', (group, key) => {
    const without = Object.fromEntries(
      Object.entries(strings[group] ?? {}).filter(([name]) => name !== key),
    );

    expect(issuesOf({ ...strings, [group]: without })).toEqual([`${group}.${key}`]);
  });

  it.each([
    ['knowledge.communityCounters.known.other', 'knowledge', 'communityCounters', 'known'],
    ['knowledge.communityCounters.saved', 'knowledge', 'communityCounters', 'saved'],
    ['knowledge.communityCounters.line', 'knowledge', 'communityCounters', 'line'],
    ['feedNotices.communityWord.added.other', 'feedNotices', 'communityWord', 'added'],
  ])('needs every placeholder in %s', (path, group, area, key) => {
    const groupStrings = strings[group] as Record<string, Record<string, unknown>>;
    const value = groupStrings[area]?.[key];
    const broken = typeof value === 'string' ? 'текст' : { ...(value as object), other: 'текст' };
    const changed = { ...groupStrings, [area]: { ...groupStrings[area], [key]: broken } };

    expect(issuesOf({ ...strings, [group]: changed })).toEqual([path]);
  });

  it('needs the {lemma} of the Illustration label', () => {
    const wordCard = { ...strings['wordCard'], illustration: 'Ілюстрація' };

    expect(issuesOf({ ...strings, wordCard })).toEqual(['wordCard.illustration']);
  });
});

describe('the 0.8.15 strings', () => {
  const strings = readJson('uk', 'strings') as Record<string, Record<string, unknown>>;
  const issuesOf = (changed: unknown) =>
    EditionStringsSchema.safeParse(changed).error?.issues.map((issue) => issue.path.join('.'));
  const parsed = EditionStringsSchema.parse(strings);
  const pluralRules = new Intl.PluralRules('uk');
  /** A count text as the app fills it: the form of `count`. */
  const countText = (forms: Record<string, string | undefined>, count: number) =>
    fill(forms[pluralRules.select(count)] ?? forms['other'] ?? '', { count: String(count) });

  it('the Ukrainian Edition carries the agreed widget texts verbatim', () => {
    expect(parsed.widget).toMatchObject({
      wordOfTheDaySeen: 'Слово дня переглянуто',
      backgroundTitle: 'Тло',
      backgroundAuto: 'Авто',
      backgroundLight: 'Світлий',
      backgroundDark: 'Темний',
      backgroundParchment: 'Пергамент',
      backgroundBlue: 'Синій',
    });
  });

  it('the Ukrainian Edition carries the agreed App Intents texts and Siri phrases verbatim', () => {
    expect(parsed.appIntents).toEqual({
      wordOfTheDay: {
        title: 'Слово дня',
        phrases: ['Слово дня в SLOVO', 'Покажи слово дня в SLOVO'],
      },
      openGame: { title: 'Відкрити гру', phrases: ['Відкрий гру в SLOVO', 'Грати в SLOVO'] },
    });
  });

  it('the Ukrainian Edition carries the agreed Collection Link texts verbatim', () => {
    const { link } = parsed.collections;

    expect(link.share).toBe('Поділитися посиланням');
    expect(fill(link.message, { name: 'Осінь', url: 'https://slovo.example/c/abc123' })).toBe(
      'Колекція «Осінь» у SLOVO: https://slovo.example/c/abc123',
    );
    expect(link.offline).toBe('Немає з’єднання. Спробуйте пізніше.');
    expect(link.add).toBe('Додати собі');
    expect(link.notFound).not.toBe('');
  });

  it('the Ukrainian Edition says how many Entries a Collection Link holds, as the contract does', () => {
    const { link } = parsed.collections;

    expect(link.tooManyEntries).toContain(String(COLLECTION_LINK_SIZE));
    expect(link.failed).not.toBe('');
  });

  it.each([
    [1, '1 слово недоступне'],
    [2, '2 слова недоступні'],
    [5, '5 слів недоступні'],
    [21, '21 слово недоступне'],
  ])('the Ukrainian count of %i skipped Entries reads «%s»', (count, text) => {
    expect(countText(parsed.collections.link.unavailable, count)).toBe(text);
  });

  it.each([
    [0, 'Колекція · 0 слів'],
    [1, 'Колекція · 1 слово'],
    [2, 'Колекція · 2 слова'],
    [5, 'Колекція · 5 слів'],
    [12, 'Колекція · 12 слів'],
    [21, 'Колекція · 21 слово'],
  ])('the Ukrainian Spotlight line of a Collection of %i Entries reads «%s»', (count, text) => {
    expect(countText(parsed.spotlight.collection, count)).toBe(text);
  });

  it.each(['appIntents', 'spotlight'])('every Edition needs %s', (key) => {
    const without = Object.fromEntries(Object.entries(strings).filter(([name]) => name !== key));

    expect(issuesOf(without)).toEqual([key]);
  });

  it.each([
    ['widget', 'wordOfTheDaySeen'],
    ['widget', 'backgroundTitle'],
    ['widget', 'backgroundAuto'],
    ['widget', 'backgroundLight'],
    ['widget', 'backgroundDark'],
    ['widget', 'backgroundParchment'],
    ['widget', 'backgroundBlue'],
    ['collections', 'link'],
  ])('every Edition needs %s.%s', (group, key) => {
    const without = Object.fromEntries(
      Object.entries(strings[group] ?? {}).filter(([name]) => name !== key),
    );

    expect(issuesOf({ ...strings, [group]: without })).toEqual([`${group}.${key}`]);
  });

  it('needs at least one Siri phrase for each App Intent', () => {
    const appIntents = {
      ...strings['appIntents'],
      openGame: { title: 'Відкрити гру', phrases: [] },
    };

    expect(issuesOf({ ...strings, appIntents })).toEqual(['appIntents.openGame.phrases']);
  });

  it.each([
    ['collections.link.message', 'collections', 'link', 'message', 'Колекція «{name}»'],
    ['collections.link.unavailable.other', 'collections', 'link', 'unavailable', undefined],
    ['spotlight.collection.other', 'spotlight', undefined, 'collection', undefined],
  ])('needs every placeholder in %s', (path, group, area, key, broken) => {
    const groupStrings = strings[group] as Record<string, Record<string, unknown>>;
    const holder = area === undefined ? groupStrings : (groupStrings[area] ?? {});
    const value = { ...(holder[key] as object), other: 'текст' };
    const changedHolder = { ...holder, [key]: broken ?? value };
    const changed = area === undefined ? changedHolder : { ...groupStrings, [area]: changedHolder };

    expect(issuesOf({ ...strings, [group]: changed })).toEqual([path]);
  });
});

describe('the 0.9 VoiceOver templates', () => {
  const strings = readJson('uk', 'strings') as Record<string, Record<string, unknown>>;
  const issuesOf = (changed: unknown) =>
    EditionStringsSchema.safeParse(changed).error?.issues.map((issue) => issue.path.join('.'));
  const parsed = EditionStringsSchema.parse(strings);
  const pluralRules = new Intl.PluralRules('uk');
  /** A count text as the app fills it: the form of `count`. */
  const countText = (forms: Record<string, string | undefined>, count: number) =>
    fill(forms[pluralRules.select(count)] ?? forms['other'] ?? '', { count: String(count) });
  const { spoken } = parsed.feedNotices.weeklyRecap;

  it.each([
    [
      1,
      'переглянуто 1 запис',
      'збережено 1 запис',
      'позначено «Знаю»: 1 запис',
      'серія: 1 день поспіль',
    ],
    [
      2,
      'переглянуто 2 записи',
      'збережено 2 записи',
      'позначено «Знаю»: 2 записи',
      'серія: 2 дні поспіль',
    ],
    [
      5,
      'переглянуто 5 записів',
      'збережено 5 записів',
      'позначено «Знаю»: 5 записів',
      'серія: 5 днів поспіль',
    ],
    [
      21,
      'переглянуто 21 запис',
      'збережено 21 запис',
      'позначено «Знаю»: 21 запис',
      'серія: 21 день поспіль',
    ],
  ])(
    'VoiceOver reads the Weekly Recap numbers of %i in Ukrainian',
    (count, seen, saved, known, streak) => {
      expect(countText(spoken.seen, count)).toBe(seen);
      expect(countText(spoken.saved, count)).toBe(saved);
      expect(countText(spoken.known, count)).toBe(known);
      expect(countText(spoken.streak, count)).toBe(streak);
    },
  );

  it('VoiceOver announces where the Rarity Test is and the Word', () => {
    expect(fill(parsed.rarityTest.announcement, { n: '3', total: '10', word: 'каганець' })).toBe(
      'Слово 3 з 10: каганець',
    );
  });

  it.each([
    ['feedNotices', 'weeklyRecap', 'spoken'],
    ['rarityTest', undefined, 'announcement'],
  ])('every Edition needs %s.%s%s', (group, area, key) => {
    const groupStrings = strings[group] as Record<string, Record<string, unknown>>;
    const holder = area === undefined ? groupStrings : (groupStrings[area] ?? {});
    const without = Object.fromEntries(Object.entries(holder).filter(([name]) => name !== key));
    const changed = area === undefined ? without : { ...groupStrings, [area]: without };

    expect(issuesOf({ ...strings, [group]: changed })).toEqual([
      [group, area, key].filter((part) => part !== undefined).join('.'),
    ]);
  });

  it('needs the {count} of every spoken Weekly Recap number and the {word} of the announcement', () => {
    const feedNotices = strings['feedNotices'] as Record<string, Record<string, unknown>>;
    const weeklyRecap = feedNotices['weeklyRecap'] ?? {};
    const brokenSpoken = { ...(weeklyRecap['spoken'] as object), streak: { other: 'серія' } };
    const rarityTest = { ...strings['rarityTest'], announcement: 'Слово {n} з {total}' };

    expect(
      issuesOf({
        ...strings,
        feedNotices: { ...feedNotices, weeklyRecap: { ...weeklyRecap, spoken: brokenSpoken } },
        rarityTest,
      }),
    ).toEqual(['rarityTest.announcement', 'feedNotices.weeklyRecap.spoken.streak.other']);
  });
});

describe('the 0.6 widget strings group', () => {
  const strings = readJson('uk', 'strings') as Record<string, unknown>;
  const widget = strings['widget'] as { guide: Record<string, unknown> };

  it('the Ukrainian Edition needs the widget group', () => {
    const without = Object.fromEntries(Object.entries(strings).filter(([key]) => key !== 'widget'));

    const result = EditionStringsSchema.safeParse(without);

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('widget');
  });

  it.each([
    'galleryName',
    'galleryDescription',
    'allEntries',
    'favorites',
    'collection',
    'modeTitle',
    'modeFavorites',
    'modeCollection',
    'modeAllEntries',
    'collectionTitle',
    'openApp',
    'noFavorites',
    'emptyCollection',
    'deletedCollection',
    'noCollection',
    'guide',
  ])('the Ukrainian Edition needs widget.%s', (key) => {
    const changed = Object.fromEntries(Object.entries(widget).filter(([name]) => name !== key));

    const result = EditionStringsSchema.safeParse({ ...strings, widget: changed });

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual([`widget.${key}`]);
  });

  it("needs the Collection's name in the overline of a Collection", () => {
    const result = EditionStringsSchema.safeParse({
      ...strings,
      widget: { ...widget, collection: 'КОЛЕКЦІЯ' },
    });

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual([
      'widget.collection',
    ]);
  });

  it('needs the three steps of the widget guide, each with its hint', () => {
    const steps = widget.guide['steps'] as { title: string; hint: string }[];
    const withTwoSteps = {
      ...strings,
      widget: { guide: { ...widget.guide, steps: steps.slice(0, 2) } },
    };

    const result = EditionStringsSchema.safeParse(withTwoSteps);

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(
      'widget.guide.steps',
    );
  });
});

describe('the 0.8 Sync strings', () => {
  const strings = readJson('uk', 'strings') as Record<string, unknown>;
  const account = strings['account'] as Record<string, unknown>;
  const sync = account['sync'] as Record<string, unknown>;
  const onboarding = strings['onboarding'] as Record<string, unknown>;
  const onboardingAccount = onboarding['account'] as Record<string, unknown>;
  /** The strings schema's issues as paths. */
  const issuesOf = (changed: unknown) =>
    EditionStringsSchema.safeParse(changed).error?.issues.map((issue) => issue.path.join('.'));
  /** The group without the key. */
  const without = (group: Record<string, unknown>, key: string) =>
    Object.fromEntries(Object.entries(group).filter(([name]) => name !== key));

  it('the Ukrainian Edition needs the sync group of the SLOVO ID screen', () => {
    expect(issuesOf({ ...strings, account: without(account, 'sync') })).toEqual(['account.sync']);
  });

  it.each(['syncing', 'waitingForNetwork', 'syncedToday', 'syncedOn', 'syncedOnInYear'])(
    'the Ukrainian Edition needs account.sync.%s',
    (key) => {
      const changed = { ...strings, account: { ...account, sync: without(sync, key) } };

      expect(issuesOf(changed)).toEqual([`account.sync.${key}`]);
    },
  );

  it.each([
    ['syncedToday', '{time}'],
    ['syncedOn', '{day}'],
    ['syncedOn', '{month}'],
    ['syncedOnInYear', '{year}'],
  ])('needs %s to say where %s goes', (key, placeholder) => {
    const text = (sync[key] as string).replace(placeholder, '');
    const changed = { ...strings, account: { ...account, sync: { ...sync, [key]: text } } };

    expect(issuesOf(changed)).toEqual([`account.sync.${key}`]);
  });

  it.each(['months', 'shortMonths'])('needs the twelve names of dates.%s', (key) => {
    const dates = strings['dates'] as Record<string, string[]>;
    const changed = { ...strings, dates: { ...dates, [key]: dates[key]?.slice(0, 11) } };

    expect(issuesOf(changed)).toEqual([`dates.${key}`]);
  });

  it("the Ukrainian Edition needs the onboarding's SLOVO ID step", () => {
    const changed = { ...strings, onboarding: without(onboarding, 'account') };

    expect(issuesOf(changed)).toEqual(['onboarding.account']);
  });

  it.each(['title', 'subtitle', 'signIn', 'continueWithout'])(
    'the Ukrainian Edition needs onboarding.account.%s',
    (key) => {
      const changed = {
        ...strings,
        onboarding: { ...onboarding, account: without(onboardingAccount, key) },
      };

      expect(issuesOf(changed)).toEqual([`onboarding.account.${key}`]);
    },
  );

  it.each(['subtitle', 'signIn'])('needs onboarding.account.%s to name the Account', (key) => {
    const text = (onboardingAccount[key] as string).replace('{name}', 'SLOVO ID');
    const changed = {
      ...strings,
      onboarding: { ...onboarding, account: { ...onboardingAccount, [key]: text } },
    };

    expect(issuesOf(changed)).toEqual([`onboarding.account.${key}`]);
  });
});

describe('the Categories of Corrections', () => {
  // Every Edition groups its Corrections in a list of its own (ADR 0050).
  it.each(editions)('the %s Edition lists its Categories of Corrections', (edition) => {
    const config = readJson(edition, 'config') as Record<string, unknown>;
    const { correctionCategories: _removed, ...without } = config;

    expect(EditionConfigSchema.parse(config).correctionCategories.length).toBeGreaterThan(0);
    expect(
      EditionConfigSchema.safeParse(without).error?.issues.map((issue) => issue.path.join('.')),
    ).toEqual(['correctionCategories']);
  });
});

describe('the Apple ids, the OTA channel and Sign in with Apple', () => {
  it.each(['legalDomain', 'appleTeamId', 'appStoreConnectAppId'])(
    'every Edition declares its %s',
    (field) => {
      for (const edition of editions) {
        const config = readJson(edition, 'config') as Record<string, unknown>;
        const { [field]: _removed, ...without } = config;

        expect(
          EditionConfigSchema.safeParse(without).error?.issues.map((issue) => issue.path.join('.')),
        ).toEqual([field]);
      }
    },
  );

  it.each(editions)('the %s Edition declares the Sign in with Apple Feature Switch', (edition) => {
    const config = readJson(edition, 'config') as { featureSwitches: Record<string, unknown> };
    const { signInWithApple: _removed, ...featureSwitches } = config.featureSwitches;

    expect(
      EditionConfigSchema.safeParse({ ...config, featureSwitches }).error?.issues.map((issue) =>
        issue.path.join('.'),
      ),
    ).toEqual(['featureSwitches.signInWithApple']);
  });

  it('the Ukrainian Edition turns Sign in with Apple on and takes its OTA updates from its own channel', () => {
    const config = EditionConfigSchema.parse(readJson('uk', 'config'));

    expect(config.featureSwitches.signInWithApple).toBe(true);
    expect(config.updateChannel).toBe('uk');
  });

  it('the Ukrainian Edition holds an Apple Team ID and App Store Connect app id, or placeholders until the owner fills them in', () => {
    const { appleTeamId, appStoreConnectAppId } = EditionConfigSchema.parse(
      readJson('uk', 'config'),
    );

    expect(appleTeamId).toMatch(/^([A-Z0-9]{10})?$/);
    expect(appStoreConnectAppId).toMatch(/^(\d+)?$/);
  });

  it('refuses an Update channel other than the Edition id (ADR 0062)', () => {
    const config = readJson('uk', 'config') as Record<string, unknown>;

    expect(
      EditionConfigSchema.safeParse({ ...config, updateChannel: 'uk-beta' }).error?.issues,
    ).toMatchObject([{ code: 'unrecognized_keys', keys: ['updateChannel'] }]);
  });

  it.each([
    ['appleTeamId', 'a1b2c3d4e5'],
    ['appleTeamId', 'A1B2C3'],
    ['appStoreConnectAppId', 'app-1'],
  ])('refuses %s "%s"', (field, value) => {
    const config = readJson('uk', 'config') as Record<string, unknown>;

    expect(
      EditionConfigSchema.safeParse({ ...config, [field]: value }).error?.issues.map((issue) =>
        issue.path.join('.'),
      ),
    ).toEqual([field]);
  });
});

describe('the strings of the Idiom Type proverb', () => {
  const strings = readJson('uk', 'strings') as Record<string, Record<string, unknown>>;
  /** The strings with one key left out of a group nested under `group`. */
  const without = (group: 'idiomCard' | 'history', nested: string, key: string) => {
    const outer = strings[group] ?? {};
    const { [key]: _removed, ...rest } = outer[nested] as Record<string, unknown>;
    return { ...strings, [group]: { ...outer, [nested]: rest } };
  };

  it('the Ukrainian Edition calls a proverb «прислів’я» on its card and in its lists', () => {
    const parsed = EditionStringsSchema.parse(strings);

    expect(parsed.idiomCard.idiomTypes.proverb).toBe('прислів’я');
    expect(parsed.history.kinds.proverb).toBe('прислів’я');
  });

  it.each([
    ['idiomCard', 'idiomTypes'],
    ['history', 'kinds'],
  ] as const)('needs %s.%s.proverb of every Edition', (group, nested) => {
    expect(
      EditionStringsSchema.safeParse(without(group, nested, 'proverb')).error?.issues.map((issue) =>
        issue.path.join('.'),
      ),
    ).toEqual([`${group}.${nested}.proverb`]);
  });
});

describe('the string of the Correction Type paronym', () => {
  const strings = readJson('uk', 'strings') as Record<string, Record<string, unknown>>;
  const correctionCard = strings['correctionCard'] ?? {};

  it('the Ukrainian Edition calls a paronym «пароніми» on its card', () => {
    expect(EditionStringsSchema.parse(strings).correctionCard.correctionTypes.paronym).toBe(
      'пароніми',
    );
  });

  it('needs correctionCard.correctionTypes.paronym of every Edition', () => {
    const { paronym: _removed, ...rest } = correctionCard['correctionTypes'] as Record<
      string,
      unknown
    >;
    const changed = { ...strings, correctionCard: { ...correctionCard, correctionTypes: rest } };

    expect(
      EditionStringsSchema.safeParse(changed).error?.issues.map((issue) => issue.path.join('.')),
    ).toEqual(['correctionCard.correctionTypes.paronym']);
  });
});

describe('the Categories that require history', () => {
  // Every Edition names them, an empty list when none does.
  it.each(editions)('the %s Edition names the Categories that require history', (edition) => {
    const config = readJson(edition, 'config') as Record<string, unknown>;
    const { categoriesRequiringHistory: _removed, ...without } = config;

    expect(EditionConfigSchema.parse(config).categoriesRequiringHistory).toBeInstanceOf(Array);
    expect(
      EditionConfigSchema.safeParse(without).error?.issues.map((issue) => issue.path.join('.')),
    ).toEqual(['categoriesRequiringHistory']);
  });

  it('the Ukrainian Edition requires history of «Розстріляна лексика» and «Слова-хамелеони»', () => {
    expect(EditionConfigSchema.parse(readJson('uk', 'config')).categoriesRequiringHistory).toEqual([
      'repressed-words',
      'chameleon-words',
    ]);
  });
});

describe('the origin languages', () => {
  // Every Edition lists them (ADR 0052), an empty list when it gives no Word an origin.
  it.each(editions)('the %s Edition lists the languages Words come from', (edition) => {
    const config = readJson(edition, 'config') as Record<string, unknown>;
    const { originLanguages: _removed, ...without } = config;

    expect(EditionConfigSchema.parse(config).originLanguages).toBeInstanceOf(Array);
    expect(
      EditionConfigSchema.safeParse(without).error?.issues.map((issue) => issue.path.join('.')),
    ).toEqual(['originLanguages']);
  });

  it('the Ukrainian Edition lists twelve, by ISO 639 code where one fits', () => {
    expect(EditionConfigSchema.parse(readJson('uk', 'config')).originLanguages).toEqual([
      { code: 'la', name: 'латинська' },
      { code: 'el', name: 'грецька' },
      { code: 'trk', name: 'тюркські' },
      { code: 'pl', name: 'польська' },
      { code: 'de', name: 'німецька' },
      { code: 'fr', name: 'французька' },
      { code: 'it', name: 'італійська' },
      { code: 'en', name: 'англійська' },
      { code: 'hbo', name: 'давньоєврейська' },
      { code: 'cu', name: 'церковнослов’янська' },
      { code: 'proto-slavic', name: 'праслов’янська' },
      { code: 'other', name: 'інша' },
    ]);
  });
});

describe('the Search letters', () => {
  // Every Edition names the letters Search reads as another (ADR 0054), none when it reads each as itself.
  it.each(editions)('the %s Edition names its Search letters', (edition) => {
    const config = readJson(edition, 'config') as Record<string, unknown>;
    const { searchLetters: _removed, ...without } = config;

    expect(EditionConfigSchema.parse(config).searchLetters).toBeInstanceOf(Object);
    expect(
      EditionConfigSchema.safeParse(without).error?.issues.map((issue) => issue.path.join('.')),
    ).toEqual(['searchLetters']);
  });

  it('the Ukrainian Edition reads ґ as г and ё as е', () => {
    expect(EditionConfigSchema.parse(readJson('uk', 'config')).searchLetters).toEqual({
      ґ: 'г',
      ё: 'е',
    });
  });
});

describe('the moods', () => {
  // Every Edition lists its moods (ADR 0054), an empty list when it has none.
  it.each(editions)('the %s Edition lists its moods', (edition) => {
    const config = readJson(edition, 'config') as Record<string, unknown>;
    const { moods: _removed, ...without } = config;

    expect(EditionConfigSchema.parse(config).moods).toBeInstanceOf(Array);
    expect(
      EditionConfigSchema.safeParse(without).error?.issues.map((issue) => issue.path.join('.')),
    ).toEqual(['moods']);
  });

  it('the Ukrainian Edition lists six moods', () => {
    expect(EditionConfigSchema.parse(readJson('uk', 'config')).moods).toEqual([
      { id: 'joyful', name: 'Радісний', emoji: '😊' },
      { id: 'sad', name: 'Сумний', emoji: '😢' },
      { id: 'in-love', name: 'Закоханий', emoji: '😍' },
      { id: 'energetic', name: 'Бадьорий', emoji: '⚡' },
      { id: 'calm', name: 'Спокійний', emoji: '😌' },
      { id: 'thoughtful', name: 'Задумливий', emoji: '🤔' },
    ]);
  });
});

describe('the legal pages of About', () => {
  const strings = readJson('uk', 'strings') as Record<string, unknown>;
  const settings = strings['settings'] as Record<string, unknown>;
  const about = settings['about'] as Record<string, unknown>;
  const issuesOf = (changed: unknown) =>
    EditionStringsSchema.safeParse(changed).error?.issues.map((issue) => issue.path.join('.'));

  it.each(editions)('the %s Edition writes no legal page address by hand', (edition) => {
    const config = readJson(edition, 'config') as Record<string, unknown>;

    expect(config).not.toHaveProperty('legalPages');
  });

  it("the Ukrainian Edition opens its pages at the Edition's domain", () => {
    expect(loadEdition(readJson('uk', 'config')).legalPages).toEqual({
      privacy: 'https://legal.slovo.example/uk/privacy',
      terms: 'https://legal.slovo.example/uk/terms',
    });
  });

  it("the Pages site names the Ukrainian Edition's legal domain as its custom domain", () => {
    const cname = readFileSync(join(EDITIONS_DIR, '..', '.github', 'pages', 'CNAME'), 'utf8');

    expect(cname.trim()).toBe(EditionConfigSchema.parse(readJson('uk', 'config')).legalDomain);
  });

  it.each(['privacyPolicy', 'terms'])('the Ukrainian Edition needs settings.about.%s', (key) => {
    const changed = {
      ...strings,
      settings: {
        ...settings,
        about: Object.fromEntries(Object.entries(about).filter(([name]) => name !== key)),
      },
    };

    expect(issuesOf(changed)).toEqual([`settings.about.${key}`]);
  });
});

describe('the strings of each Game Mode', () => {
  const strings = readJson('uk', 'strings') as Record<string, unknown>;
  const game = strings['game'] as Record<string, unknown>;
  const modes = game['modes'] as Record<string, Record<string, unknown>>;
  /** The strings with the Game's mode texts changed. */
  const withModes = (changed: Record<string, unknown>) => ({
    ...strings,
    game: { ...game, modes: { ...modes, ...changed } },
  });
  /** The issues the strings schema finds, as paths. */
  const issuesOf = (changed: unknown) =>
    EditionStringsSchema.safeParse(changed).error?.issues.map((issue) => issue.path.join('.'));

  it('the Ukrainian Edition holds one entry per Core Game Mode, under its id', () => {
    expect(Object.keys(modes)).toEqual([
      'guess-word',
      'stress',
      'pairs',
      'anagram',
      'by-letters',
      'type-word',
      'origin',
      'correction',
      'anglicism',
      'idiom-meaning',
      'build-idiom',
      'survival',
      'timed',
    ]);
  });

  it.each(Object.keys(modes))(
    'needs the %s mode to say what its card says with too few eligible Entries',
    (modeId) => {
      const mode = modes[modeId] ?? {};
      const refusals = Object.fromEntries(
        Object.entries(mode['refusals'] as object).filter(([key]) => key !== 'too-few-entries'),
      );

      expect(issuesOf(withModes({ [modeId]: { ...mode, refusals } }))).toEqual([
        `game.modes.${modeId}.refusals.too-few-entries`,
      ]);
    },
  );

  it.each(['overline', 'title', 'description', 'sample', 'roundLabel', 'refusals'])(
    'needs every mode alike to have its %s',
    (key) => {
      const changed = Object.fromEntries(
        Object.entries(modes).map(([modeId, mode]) => [
          modeId,
          Object.fromEntries(Object.entries(mode).filter(([name]) => name !== key)),
        ]),
      );

      expect(issuesOf(withModes(changed))).toEqual(
        Object.keys(modes).map((modeId) => `game.modes.${modeId}.${key}`),
      );
    },
  );

  it.each([
    ['correction', 'corrections-out-of-mix'],
    ['type-word', 'corrections-out-of-mix'],
    ['anglicism', 'corrections-out-of-mix'],
    ['idiom-meaning', 'idioms-out-of-mix'],
    ['build-idiom', 'idioms-out-of-mix'],
  ])('the Ukrainian %s mode says what its card says with %s', (modeId, refusal) => {
    expect(modes[modeId]?.['refusals']).toHaveProperty([refusal]);
  });

  it('takes a mode an Edition adds under its own id, in the same shape', () => {
    expect(issuesOf(withModes({ 'test-lemma': modes['guess-word'] }))).toBeUndefined();
  });

  it('rejects a text for a refusal the Core never gives', () => {
    const mode = modes['guess-word'] ?? {};
    const refusals = { ...(mode['refusals'] as object), 'too-hard': 'Заважко.' };

    expect(issuesOf(withModes({ 'guess-word': { ...mode, refusals } }))).toEqual([
      'game.modes.guess-word.refusals',
    ]);
  });

  it('rejects a mode text outside the modes', () => {
    expect(issuesOf({ ...strings, game: { ...game, tooFewEntries: 'Замало слів.' } })).toEqual([
      'game',
    ]);
  });
});

describe('the 0.6 share strings group', () => {
  const strings = readJson('uk', 'strings') as Record<string, unknown>;
  const share = strings['share'] as Record<string, unknown>;
  /** The issues the strings schema finds, as paths. */
  const issuesOf = (changed: unknown) =>
    EditionStringsSchema.safeParse(changed).error?.issues.map((issue) => issue.path.join('.'));

  it('the Ukrainian Edition needs the share group', () => {
    const without = Object.fromEntries(Object.entries(strings).filter(([key]) => key !== 'share'));

    expect(issuesOf(without)).toContain('share');
  });

  it.each([
    'button',
    'title',
    'format',
    'story',
    'square',
    'share',
    'wordOfTheDay',
    'nonStandard',
    'standard',
    'captureFailed',
    'weeklyRecap',
  ])('the Ukrainian Edition needs share.%s', (key) => {
    const shareWithout = Object.fromEntries(Object.entries(share).filter(([name]) => name !== key));

    expect(issuesOf({ ...strings, share: shareWithout })).toEqual([`share.${key}`]);
  });
});

describe('the 0.7 account and email strings groups', () => {
  const strings = readJson('uk', 'strings') as Record<string, unknown>;
  const account = strings['account'] as Record<string, unknown>;
  const email = strings['email'] as Record<string, unknown>;
  /** The issues the strings schema finds, as paths. */
  const issuesOf = (changed: unknown) =>
    EditionStringsSchema.safeParse(changed).error?.issues.map((issue) => issue.path.join('.'));
  /** The group without the key. */
  const without = (group: unknown, key: string) =>
    Object.fromEntries(
      Object.entries(group as Record<string, unknown>).filter(([name]) => name !== key),
    );

  it.each(['account', 'email'])('the Ukrainian Edition needs the %s group', (group) => {
    expect(issuesOf(without(strings, group))).toEqual([group]);
  });

  it.each([
    'signedOut',
    'signInWithGoogle',
    'emailLabel',
    'sendCode',
    'codeLabel',
    'resend',
    'resendIn',
    'changeEmail',
    'signedInAs',
    'signOut',
    'signOutEverywhere',
    'delete',
    'problems',
  ])('the Ukrainian Edition needs account.%s', (key) => {
    expect(issuesOf({ ...strings, account: without(account, key) })).toEqual([`account.${key}`]);
  });

  it.each(['button', 'title', 'message', 'confirm', 'cancel'])(
    'needs account.delete.%s, the confirmation of deleting the Account',
    (key) => {
      const deletion = account['delete'];

      expect(
        issuesOf({ ...strings, account: { ...account, delete: without(deletion, key) } }),
      ).toEqual([`account.delete.${key}`]);
    },
  );

  it.each([
    'offline',
    'invalid-email',
    'wrong-code',
    'code-expired',
    'too-many-requests',
    'refused',
    'unexpected',
  ])('needs a line for the problem %s', (problem) => {
    const problems = without(account['problems'], problem);

    expect(issuesOf({ ...strings, account: { ...account, problems } })).toEqual([
      `account.problems.${problem}`,
    ]);
  });

  it('rejects a line for a problem the Core never gives', () => {
    const problems = { ...(account['problems'] as object), 'too-hard': 'Заважко.' };

    expect(issuesOf({ ...strings, account: { ...account, problems } })).toEqual([
      'account.problems',
    ]);
  });

  it('needs the tries left in every form of the wrong-code line', () => {
    const problems = {
      ...(account['problems'] as object),
      'wrong-code': { one: 'Невірний код.', other: 'Невірний код. Спроб: {count}.' },
    };

    expect(issuesOf({ ...strings, account: { ...account, problems } })).toEqual([
      'account.problems.wrong-code.one',
    ]);
  });

  it('needs the name SLOVO ID, which every Edition shares, in the words to delete it', () => {
    const deletion = { ...(account['delete'] as object), button: 'Видалити акаунт' };

    expect(issuesOf({ ...strings, account: { ...account, delete: deletion } })).toEqual([
      'account.delete.button',
    ]);
  });

  it.each(['subject', 'body'])('needs email.%s, with the {code} placeholder', (key) => {
    expect(issuesOf({ ...strings, email: without(email, key) })).toEqual([`email.${key}`]);
    expect(issuesOf({ ...strings, email: { ...email, [key]: 'Ваш код' } })).toEqual([
      `email.${key}`,
    ]);
  });

  it('needs the subject of the email to be one line, since it becomes a mail header', () => {
    expect(issuesOf({ ...strings, email: { ...email, subject: 'Код {code}\nBcc: x@y' } })).toEqual([
      'email.subject',
    ]);
  });

  it('rejects a text that neither group has', () => {
    expect(issuesOf({ ...strings, email: { ...email, footer: 'Дякуємо.' } })).toEqual(['email']);
  });
});

/** The CLDR plural categories, the only keys of a plural-forms object. */
const PLURAL_CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

/** Every plural-forms object (one with an `other` form) in the strings or a group of them. */
function pluralsOf(value: unknown): Record<string, string>[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  // A Mistake Report's types hold an `other` too, beside keys no plural has.
  return 'other' in record && Object.keys(record).every((key) => PLURAL_CATEGORIES.has(key))
    ? [record as Record<string, string>]
    : Object.values(record).flatMap(pluralsOf);
}

describe('plural forms of a count', () => {
  it('takes the forms a language has, each with the count in it', () => {
    expect(
      PluralSchema.safeParse({
        one: '{count} запис',
        few: '{count} записи',
        other: '{count} записів',
      }).success,
    ).toBe(true);
  });

  it.each([
    ['a form without the count', { one: 'один запис', other: '{count} записів' }],
    ['no `other` form', { one: '{count} запис', many: '{count} записів' }],
    ['a form that is not a CLDR category', { single: '{count} запис', other: '{count} записів' }],
  ])('rejects %s', (_, forms) => {
    expect(PluralSchema.safeParse(forms).success).toBe(false);
  });
});

describe('plural forms of a label beside its number', () => {
  it('takes the forms a language has, none with the count in it', () => {
    expect(
      PluralLabelSchema.safeParse({
        one: 'день поспіль',
        few: 'дні поспіль',
        other: 'днів поспіль',
      }).success,
    ).toBe(true);
  });

  it.each([
    ['no `other` form', { one: 'день поспіль', many: 'днів поспіль' }],
    ['a form that is not a CLDR category', { single: 'день поспіль', other: 'днів поспіль' }],
    ['an empty form', { one: '', other: 'днів поспіль' }],
    ['a form with the count in it', { one: '{count} день поспіль', other: 'днів поспіль' }],
  ])('rejects %s', (_, forms) => {
    expect(PluralLabelSchema.safeParse(forms).success).toBe(false);
  });
});

describe('UI strings the app fills in', () => {
  const strings = openEdition(EDITIONS_DIR, 'uk').read('strings');
  const { wordOfTheDay, mix, settings } = strings;

  it.each([
    ['mix.rarity.floor', { ...strings, mix: { ...mix, rarity: { ...mix.rarity, floor: 'від' } } }],
    [
      'wordOfTheDay.badge',
      { ...strings, wordOfTheDay: { ...wordOfTheDay, badge: 'Слово дня · {day}' } },
    ],
    [
      'settings.soonAccessibilityLabel',
      { ...strings, settings: { ...settings, soonAccessibilityLabel: 'скоро буде доступно' } },
    ],
    [
      'settings.about.versionLine',
      {
        ...strings,
        settings: { ...settings, about: { ...settings.about, versionLine: 'Версія {version}' } },
      },
    ],
  ])('needs every placeholder in %s', (path, changed) => {
    const result = EditionStringsSchema.safeParse(changed);

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual([path]);
  });
});

describe('Edition design tokens', () => {
  it.each(editions.filter((edition) => has(edition, 'tokens')))(
    'the %s Edition supplies valid design tokens',
    (edition) => {
      expect(EditionTokensSchema.safeParse(readJson(edition, 'tokens')).error).toBeUndefined();
    },
  );

  it.each(['light', 'dark'] as const)(
    'needs the colour of a wrong answer in %s, from 0.5',
    (scheme) => {
      const tokens = EditionTokensSchema.parse(readJson('uk', 'tokens'));
      const withoutWrong = Object.fromEntries(
        Object.entries(tokens.colors?.[scheme] ?? {}).filter(([role]) => role !== 'wrong'),
      );

      const result = EditionTokensSchema.safeParse({
        ...tokens,
        colors: { ...tokens.colors, [scheme]: withoutWrong },
      });

      expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual([
        `colors.${scheme}.wrong`,
      ]);
    },
  );

  it('the Ukrainian Edition supplies its own colours, type families and radii', () => {
    const tokens = EditionTokensSchema.parse(readJson('uk', 'tokens'));

    expect(Object.keys(tokens).sort()).toEqual(['colors', 'fontFamilies', 'radii']);
  });

  it.each([
    ['a colour that is not #RRGGBB or rgba()', { colors: { light: { ink: 'red' } } }],
    ['a missing colour in a scheme', { colors: { light: {}, dark: {} } }],
    ['a negative radius', { radii: { card: -1, chip: 2, button: 4, sheet: 22 } }],
    ['an unknown token group', { shadows: {} }],
  ])('rejects %s', (_, tokens) => {
    expect(EditionTokensSchema.safeParse(tokens).success).toBe(false);
  });
});

describe('Edition Decor', () => {
  const withDecor = editions.filter((edition) => has(edition, 'decor'));

  it.each(withDecor)('the %s Edition supplies valid Decor', (edition) => {
    expect(EditionDecorSchema.safeParse(readJson(edition, 'decor')).error).toBeUndefined();
  });

  it('the Ukrainian Edition fills every Decor slot the Feed, the Game result, the splash and the Share Cards use', () => {
    const decor = EditionDecorSchema.parse(readJson('uk', 'decor'));

    expect(Object.keys(decor).sort()).toEqual([
      'background',
      'corners',
      'divider',
      'emptyState',
      'holidays',
      'seasons',
      'shareCard',
      'splash',
      'victory',
    ]);
    expect(decor.emptyState?.error).toBeDefined();
    expect(decor.splash?.band).toBeDefined();
  });

  it.each(editions.filter((edition) => has(edition, 'decor')))(
    'the %s Edition supplies Season motifs while its seasonalDecor switch is on',
    (edition) => {
      const { featureSwitches } = EditionConfigSchema.parse(readJson(edition, 'config'));
      const { seasons } = EditionDecorSchema.parse(readJson(edition, 'decor'));

      if (featureSwitches.seasonalDecor) expect(seasons).toBeDefined();
    },
  );

  it('the Ukrainian Edition lists its Holidays by rule', () => {
    const { holidays } = EditionDecorSchema.parse(readJson('uk', 'decor'));

    expect(holidays?.map(({ rule }) => rule)).toEqual([
      { kind: 'fixed', day: 24, month: 8 },
      { kind: 'nthWeekday', nth: 3, weekday: 'thursday', month: 5 },
      { kind: 'fixed', day: 25, month: 12 },
      { kind: 'fixed', day: 1, month: 1 },
    ]);
  });

  /** The Ukrainian Decor with its first Holiday's rule replaced. */
  const withFirstHolidayRule = (rule: unknown) => {
    const decor = EditionDecorSchema.parse(readJson('uk', 'decor'));
    const [first, ...rest] = decor.holidays ?? [];
    return { ...decor, holidays: [{ ...first, rule }, ...rest] };
  };

  it.each([
    ['an unknown rule', { kind: 'easter' }],
    ['30 February', { kind: 'fixed', day: 30, month: 2 }],
    ['31 April', { kind: 'fixed', day: 31, month: 4 }],
    ['month 13', { kind: 'fixed', day: 1, month: 13 }],
    ['a fifth weekday', { kind: 'nthWeekday', nth: 5, weekday: 'thursday', month: 5 }],
    ['an unknown weekday', { kind: 'nthWeekday', nth: 3, weekday: 'четвер', month: 5 }],
  ])('refuses a Holiday on %s', (_, rule) => {
    expect(EditionDecorSchema.safeParse(withFirstHolidayRule(rule)).success).toBe(false);
  });

  it('accepts a Holiday on 29 February', () => {
    const decor = withFirstHolidayRule({ kind: 'fixed', day: 29, month: 2 });

    expect(EditionDecorSchema.safeParse(decor).error).toBeUndefined();
  });

  it('refuses Season motifs without every Season', () => {
    const decor = EditionDecorSchema.parse(readJson('uk', 'decor'));
    const { winter: _, ...withoutWinter } = decor.seasons ?? {};

    expect(EditionDecorSchema.safeParse({ ...decor, seasons: withoutWinter }).success).toBe(false);
  });

  it.each(editions.filter((edition) => has(edition, 'tokens') && has(edition, 'splash')))(
    'the %s Edition has a native splash on its own background colour in both Themes',
    (edition) => {
      const { colors } = EditionTokensSchema.parse(readJson(edition, 'tokens'));
      const splash = SplashDecorSchema.parse(readJson(edition, 'splash'));

      expect(splash.light.backgroundColor).toBe(colors?.light.background);
      expect(splash.dark.backgroundColor).toBe(colors?.dark.background);
    },
  );

  /** The text colour roles drawn straight on the screen background. */
  const textRoles = ['ink', 'muted', 'inkSecondary', 'accent'] as const;

  describe.each(withDecor.filter((edition) => has(edition, 'tokens')))(
    'the %s Edition',
    (edition) => {
      const { colors } = EditionTokensSchema.parse(readJson(edition, 'tokens'));
      const { background, seasons, holidays } = EditionDecorSchema.parse(
        readJson(edition, 'decor'),
      );
      /** Every tile Decor slot 1 may repeat: the plain one, each Season's and each Holiday's. */
      const tiles = [
        ...(background === undefined ? [] : [background.tile]),
        ...Object.values(seasons ?? {}).map(({ tile }) => tile),
        ...(holidays ?? []).map(({ motif }) => motif.tile),
      ];
      /** Every divider centre slot 2 may draw on a Season or a Holiday. */
      const centres = [
        ...Object.values(seasons ?? {}).map(({ centre }) => centre),
        ...(holidays ?? []).map(({ motif }) => motif.centre),
      ];

      it.each(['light', 'dark'] as const)(
        'keeps text at WCAG AA contrast over its background Decor in %s',
        (scheme) => {
          if (colors === undefined) return;
          const screen = colors[scheme].background;
          const stitched = tiles.flatMap(({ layers }) =>
            layers.map((layer) => over(layer[scheme], screen)),
          );

          for (const role of textRoles) {
            const text = colors[scheme][role satisfies keyof ColorTokens];
            for (const behind of [parseColor(screen), ...stitched]) {
              expect(
                contrast(parseColor(text), behind),
                `${role} over ${String(behind)}`,
              ).toBeGreaterThanOrEqual(4.5);
            }
          }
        },
      );

      it.each(['light', 'dark'] as const)(
        'draws each Season and Holiday divider centre at 3:1 or more over the screen in %s',
        (scheme) => {
          if (colors === undefined) return;
          const screen = colors[scheme].background;

          for (const { layers } of centres) {
            const strongest = Math.max(
              ...layers.map((layer) => contrast(over(layer[scheme], screen), parseColor(screen))),
            );
            expect(strongest, JSON.stringify(layers)).toBeGreaterThanOrEqual(3);
          }
        },
      );
    },
  );

  it('gives every Ukrainian Season and Holiday a motif of its own', () => {
    const { background, divider, seasons, holidays } = EditionDecorSchema.parse(
      readJson('uk', 'decor'),
    );
    const motifs = [...Object.values(seasons ?? {}), ...(holidays ?? []).map(({ motif }) => motif)];
    const drawn = (motif: unknown) => JSON.stringify(motif);

    expect(motifs).toHaveLength(8);
    expect(new Set(motifs.map(({ tile }) => drawn(tile))).size).toBe(8);
    expect(new Set(motifs.map(({ centre }) => drawn(centre))).size).toBe(8);
    expect(motifs.map(({ tile }) => drawn(tile))).not.toContain(drawn(background?.tile));
    expect(motifs.map(({ centre }) => drawn(centre))).not.toContain(drawn(divider?.centre));
  });
});

/**
 * Every pair of a text colour and the colour it is drawn on in the 0.2
 * screens: the Feed, its cards and states, Settings and the tab bar.
 */
const textPairs: readonly (readonly [text: keyof ColorTokens, behind: keyof ColorTokens])[] = [
  // Screen titles, the end-of-Cycle and error states, the loading line, the tab bar.
  ['ink', 'background'],
  ['muted', 'background'],
  ['accent', 'background'],
  ['inactiveTab', 'background'],
  // The Word card and the Correction card.
  ['ink', 'surface'],
  ['muted', 'surface'],
  ['inkSecondary', 'surface'],
  ['accent', 'surface'],
  // The Category chip and the Correction's example pair.
  ['ink', 'surfaceSunken'],
  ['muted', 'surfaceSunken'],
  // The segmented control.
  ['ink', 'track'],
  // Inverted: the Word of the Day badge, the error button, the swipe hint.
  ['background', 'accent'],
  ['background', 'ink'],
  // The Pronunciation message on ink, and the speaker while it plays on accent.
  ['surface', 'ink'],
  ['surface', 'accent'],
];

/** The Core's colours and those of every Edition that supplies its own. */
const tokenSets = [
  ['the Core', coreTokens.colors] as const,
  ...editions
    .filter((edition) => has(edition, 'tokens'))
    .flatMap((edition) => {
      const { colors } = EditionTokensSchema.parse(readJson(edition, 'tokens'));
      return colors === undefined ? [] : [[`the ${edition} Edition`, colors] as const];
    }),
];

/** The other colour scheme, whose colours an inverted card draws its content in. */
const otherScheme = { light: 'dark', dark: 'light' } as const;

describe('WCAG AA contrast of the 0.2 screens', () => {
  describe.each(tokenSets)('%s', (_, colors) => {
    it.each(['light', 'dark'] as const)('keeps every text at 4.5:1 or more in %s', (scheme) => {
      for (const [text, behind] of textPairs) {
        expect(
          contrast(parseColor(colors[scheme][text]), parseColor(colors[scheme][behind])),
          `${text} on ${behind}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});

describe('WCAG AA contrast of the 0.3 Favorites screens', () => {
  describe.each(tokenSets)('%s', (_, colors) => {
    it.each(['light', 'dark'] as const)(
      'keeps the Favorites card, drawn in the other scheme on the ink fill, at 4.5:1 or more in %s',
      (scheme) => {
        const fill = parseColor(colors[scheme].ink);
        for (const text of ['ink', 'muted', 'inkSecondary', 'accent'] as const) {
          expect(
            contrast(parseColor(colors[otherScheme[scheme]][text]), fill),
            `the other scheme's ${text} on ink`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      },
    );

    it.each(['light', 'dark'] as const)(
      'keeps white on the destructive action at 4.5:1 and the filled heart at 3:1 in %s',
      (scheme) => {
        const { destructive, heart, background, surface } = colors[scheme];
        expect(contrast([255, 255, 255], parseColor(destructive))).toBeGreaterThanOrEqual(4.5);
        // The heart is a graphic, which needs 3:1 against what it sits on (WCAG 1.4.11).
        for (const behind of [background, surface]) {
          expect(contrast(parseColor(heart), parseColor(behind))).toBeGreaterThanOrEqual(3);
        }
      },
    );
  });
});

describe('WCAG AA contrast of the 0.5 Game screens', () => {
  describe.each(tokenSets)('%s', (_, colors) => {
    it('keeps white on the right and the wrong option, filled in the light colours, at 4.5:1 or more', () => {
      for (const fill of [colors.light.correct, colors.light.wrong]) {
        expect(contrast([255, 255, 255], parseColor(fill)), fill).toBeGreaterThanOrEqual(4.5);
      }
    });

    it.each(['light', 'dark'] as const)(
      "keeps the answer sheet's title, drawn in the other scheme on its surface, at 4.5:1 or more in %s",
      (scheme) => {
        const { surface, correct, wrong } = colors[otherScheme[scheme]];
        for (const title of [correct, wrong]) {
          expect(contrast(parseColor(title), parseColor(surface)), title).toBeGreaterThanOrEqual(
            4.5,
          );
        }
      },
    );
  });
});

type Rgb = readonly [number, number, number];

/** `#RRGGBB` or `rgba(r, g, b, a)` as red, green, blue and alpha. */
function parseRgba(color: string): readonly [number, number, number, number] {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (hex !== null) {
    const [, r = '', g = '', b = ''] = hex;
    return [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16), 1];
  }
  const [r = 0, g = 0, b = 0, a = 1] = (/\(([^)]*)\)/.exec(color)?.[1] ?? '')
    .split(',')
    .map(Number);
  return [r, g, b, a];
}

function parseColor(color: string): Rgb {
  const [r, g, b] = parseRgba(color);
  return [r, g, b];
}

/** A colour drawn over an opaque one. */
function over(color: string, behind: string): Rgb {
  const [r, g, b, a] = parseRgba(color);
  const [br, bg, bb] = parseColor(behind);
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];
}

/** The WCAG 2 contrast ratio of two opaque colours. */
function contrast(first: Rgb, second: Rgb): number {
  const luminance = (rgb: Rgb) => {
    const [r = 0, g = 0, b = 0] = rgb.map((channel) => {
      const c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}
