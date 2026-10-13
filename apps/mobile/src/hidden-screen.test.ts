import { EditionStringsSchema, type Plural, type Word } from '@slovo/contracts';
import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  type Clock,
  type Composition,
  type Edition,
} from '@slovo/core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { hiddenScreenModel, hiddenSummary } from './hidden-screen';

const editionFile = (name: string): unknown =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../../editions/uk/${name}`, import.meta.url)), 'utf8'),
  );

const strings = EditionStringsSchema.parse(editionFile('strings.json'));
const ukrainian = loadEdition(editionFile('edition.json'));

/** The Edition's own plural rules, as the shell's `count` applies them. */
const pluralRules = new Intl.PluralRules(ukrainian.locale);
const count = (forms: Plural, value: number) =>
  (forms[pluralRules.select(value)] ?? forms.other).replace('{count}', String(value));

const [first, second] = ukrainian.categories;
if (first === undefined || second === undefined) throw new Error('The Edition needs Categories');

function word(id: string, categoryId: string, extra: Partial<Word> = {}): Word {
  return {
    kind: 'word',
    id,
    lemma: id.slice(2),
    stress: [],
    partOfSpeech: 'adverb',
    primaryDefinition: 'A meaning.',
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId,
    rarity: 3,
    sources: [{ title: 'Test source' }],
    correctionIds: [],
    retired: false,
    ...extra,
  };
}

const content = createMemoryContentPort({
  words: [
    word('w_one', first.id, { registers: ['archaic'] }),
    word('w_two', second.id, { partOfSpeech: 'noun', gender: 'feminine' }),
    word('w_three', second.id),
  ],
  corrections: [
    {
      kind: 'correction',
      id: 'c_one',
      nonStandardForm: 'слідуючий',
      correctionType: 'russianism',
      standardEquivalents: ['наступний'],
      explanation: 'An explanation.',
      examplePair: { nonStandard: 'Так кажуть.', standard: 'Краще так.' },
      sources: [{ title: 'Test source' }],
      retired: false,
    },
  ],
});

/** A clock the test moves by hand. */
function fakeClock() {
  let now = new Date('2026-10-13T09:00:00Z').getTime();
  const clock: Clock = { now: () => new Date(now), timeZone: () => 'Europe/Kyiv' };
  return {
    clock,
    advance() {
      now += 60_000;
    },
  };
}

async function open(): Promise<{ app: Composition; advance: () => void }> {
  const time = fakeClock();
  const app = await openComposition({
    content,
    edition: ukrainian,
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: time.clock,
    random: { next: () => 0.25 },
  });
  return {
    app,
    advance: () => {
      time.advance();
    },
  };
}

const modelOf = (app: Composition, edition: Pick<Edition, 'isFeatureEnabled'> = ukrainian) =>
  hiddenScreenModel({
    edition,
    hiddenEntries: app.hiddenEntries.list,
    mix: app.mix.state,
    strings,
  });

describe('the «Приховане» screen', () => {
  it('is empty while nothing is hidden', async () => {
    const { app } = await open();

    const model = modelOf(app);

    expect(model.entries).toEqual([]);
    expect(model.categories).toEqual([]);
    expect(model.empty).toBe(true);
  });

  it('lists the Hidden Entries newest first, each with its kind and labels', async () => {
    const { app, advance } = await open();
    for (const id of ['w_one', 'c_one', 'w_two']) {
      await app.hiddenEntries.hide(id);
      advance();
    }

    const model = modelOf(app);

    expect(model.empty).toBe(false);
    expect(model.entries.map(({ entryId }) => entryId)).toEqual(['w_two', 'c_one', 'w_one']);
    expect(model.entries.map(({ labels }) => labels.text)).toEqual([
      'слово · ім., ж. р.',
      'виправлення · росіянізм',
      'слово · присл., заст.',
    ]);
    // VoiceOver reads the whole words, not the abbreviations.
    expect(model.entries.map(({ labels }) => labels.spoken)).toEqual([
      'слово, іменник, жіночий рід',
      'виправлення, росіянізм',
      'слово, прислівник, застаріле',
    ]);
  });

  it('lists the Hidden Categories by name, in the Edition’s order', async () => {
    const { app } = await open();
    await app.mix.takeOut(second.id);
    await app.mix.takeOut(first.id);

    const model = modelOf(app);

    expect(model.categories).toEqual([
      { id: first.id, name: first.displayName },
      { id: second.id, name: second.displayName },
    ]);
    expect(model.empty).toBe(false);
  });

  it('lists Corrections taken out of the Mix as hidden too, so the screen is not empty, and drops them once they are on', async () => {
    const { app } = await open();
    expect(modelOf(app).corrections).toBe(undefined);

    await app.mix.setCorrections(false);

    expect(modelOf(app).corrections).toEqual({ name: 'Виправлення' });
    expect(modelOf(app).empty).toBe(false);

    await app.mix.setCorrections(true);

    expect(modelOf(app).corrections).toBe(undefined);
    expect(modelOf(app).empty).toBe(true);
  });

  it('leaves Corrections out of the screen when the Edition does not turn them on', async () => {
    const { app } = await open();
    await app.mix.setCorrections(false);

    const model = modelOf(app, { isFeatureEnabled: () => false });

    expect(model.corrections).toBe(undefined);
    expect(model.empty).toBe(true);
  });

  it('puts a Category back in the Mix, so the Mix and the screen never disagree', async () => {
    const { app } = await open();
    await app.mix.takeOut(first.id);
    await app.mix.takeOut(second.id);

    await app.mix.putBack(first.id);

    expect(modelOf(app).categories.map(({ id }) => id)).toEqual([second.id]);
    expect(app.mix.state.categoryIds).toContain(first.id);
    expect(app.mix.state.hiddenCategories.map(({ id }) => id)).toEqual([second.id]);
  });
});

describe('the «Приховані записи» row of Settings', () => {
  it('counts the Hidden Entries in the Edition’s plural forms', async () => {
    const { app } = await open();
    const said = [
      hiddenSummary({ hiddenEntries: app.hiddenEntries.list, strings: strings.hidden, count }),
    ];

    for (const id of ['w_one', 'w_two', 'w_three']) {
      await app.hiddenEntries.hide(id);
      said.push(
        hiddenSummary({ hiddenEntries: app.hiddenEntries.list, strings: strings.hidden, count }),
      );
    }

    expect(said).toEqual(['0 записів', '1 запис', '2 записи', '3 записи']);
  });

  it('follows a restore', async () => {
    const { app } = await open();
    await app.hiddenEntries.hide('w_one');
    await app.hiddenEntries.hide('w_two');

    await app.hiddenEntries.restore('w_one');

    expect(
      hiddenSummary({ hiddenEntries: app.hiddenEntries.list, strings: strings.hidden, count }),
    ).toBe('1 запис');
  });
});
