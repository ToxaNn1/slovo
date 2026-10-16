import { EditionStringsSchema, type Plural } from '@slovo/contracts';
import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
  type Edition,
} from '@slovo/core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { mixScreenModel, mixSummary } from './mix-screen';

const editionFile = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../../../editions/uk/${name}`, import.meta.url)),
      'utf8',
    ),
  );

const strings = EditionStringsSchema.parse(editionFile('strings.json'));
const ukrainian = loadEdition(editionFile('edition.json'));

/** The Edition's own plural rules, as the shell's `count` applies them. */
const pluralRules = new Intl.PluralRules(ukrainian.locale);
const count = (forms: Plural, value: number) =>
  (forms[pluralRules.select(value)] ?? forms.other).replace('{count}', String(value));

async function open(edition: Edition): Promise<Composition> {
  return openComposition({
    content: createMemoryContentPort(),
    edition,
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: { now: () => new Date('2026-10-13T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
}

const [first] = ukrainian.categories;
if (first === undefined) throw new Error('The Edition needs Categories');

describe('the Мій Мікс screen', () => {
  it('offers every Category of the Edition in its order, all on in the default Mix', async () => {
    const { mix } = await open(ukrainian);

    const model = mixScreenModel({ edition: ukrainian, mix: mix.state });

    expect(model.chips.map(({ id }) => id)).toEqual(ukrainian.categories.map(({ id }) => id));
    expect(model.chips.map(({ name }) => name)).toEqual(
      ukrainian.categories.map(({ displayName }) => displayName),
    );
    expect(model.chips.every(({ on }) => on)).toBe(true);
    expect(model.allOn).toBe(true);
    expect(model.chips.some(({ disabled }) => disabled)).toBe(false);
    expect(model.lastCategoryHint).toBe(false);
  });

  it('shows a Category taken out as off and «Усі» as not on, until «Усі» turns every Category on', async () => {
    const { mix } = await open(ukrainian);

    await mix.takeOut(first.id);
    const taken = mixScreenModel({ edition: ukrainian, mix: mix.state });
    expect(taken.chips.find(({ id }) => id === first.id)?.on).toBe(false);
    expect(taken.chips.filter(({ on }) => on)).toHaveLength(ukrainian.categories.length - 1);
    expect(taken.allOn).toBe(false);

    await mix.turnAllOn();
    const all = mixScreenModel({ edition: ukrainian, mix: mix.state });
    expect(all.chips.every(({ on }) => on)).toBe(true);
    expect(all.allOn).toBe(true);
  });

  it('disables the chip of the last Category in the Mix and says why', async () => {
    const { mix } = await open(ukrainian);
    for (const { id } of ukrainian.categories) {
      if (id !== first.id) await mix.takeOut(id);
    }

    const model = mixScreenModel({ edition: ukrainian, mix: mix.state });

    expect(model.chips.filter(({ disabled }) => disabled).map(({ id }) => id)).toEqual([first.id]);
    expect(model.lastCategoryHint).toBe(true);
    // The Core refuses the same thing, so the disabled chip is not the only guard.
    expect(await mix.takeOut(first.id)).toBe(false);
  });

  it('shows the Corrections switch only when the Edition turns Corrections on', async () => {
    const withoutCorrections: Edition = {
      ...ukrainian,
      isFeatureEnabled: (feature) =>
        feature !== 'corrections' && ukrainian.isFeatureEnabled(feature),
    };
    const { mix } = await open(ukrainian);

    expect(mixScreenModel({ edition: ukrainian, mix: mix.state }).corrections).toEqual({
      on: true,
    });
    await mix.setCorrections(false);
    expect(mixScreenModel({ edition: ukrainian, mix: mix.state }).corrections).toEqual({
      on: false,
    });
    expect(mixScreenModel({ edition: withoutCorrections, mix: mix.state }).corrections).toBe(
      undefined,
    );
  });
});

describe('the «Мій Мікс» row of Settings', () => {
  it('says «Усі» while every Category is in the Mix, and Corrections do not change it', async () => {
    const { mix } = await open(ukrainian);

    expect(mixSummary({ mix: mix.state, strings: strings.mix, count })).toBe('Усі');
    await mix.setCorrections(false);
    expect(mixSummary({ mix: mix.state, strings: strings.mix, count })).toBe('Усі');
  });

  it('counts the Categories in the Mix in the Edition’s plural forms', async () => {
    const { mix } = await open(ukrainian);
    const said: string[] = [];

    for (const { id } of ukrainian.categories.slice(1)) {
      await mix.takeOut(id);
      said.push(mixSummary({ mix: mix.state, strings: strings.mix, count }));
    }

    expect(said).toEqual([
      '9 категорій',
      '8 категорій',
      '7 категорій',
      '6 категорій',
      '5 категорій',
      '4 категорії',
      '3 категорії',
      '2 категорії',
      '1 категорія',
    ]);
  });
});
