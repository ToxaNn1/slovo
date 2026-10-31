import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
  type Edition,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { describe, expect, it } from 'vitest';

import { mixScreenModel, mixSummary } from './mix-screen';
import { count, strings, ukrainian } from '../test-support';

/** The Language Pack's ten Categories, in its order. */
const categories = Array.from({ length: 10 }, (_, index) => ({
  id: `category-${String(index)}`,
  displayName: `Категорія ${String(index)}`,
}));

/** The Language Pack's three Categories of Corrections, in its order. */
const correctionCategories = [
  { id: 'work', displayName: 'На роботі' },
  { id: 'shop', displayName: 'У магазині' },
  { id: 'transport', displayName: 'Транспорт' },
];

async function open(edition: Edition): Promise<Composition> {
  return openComposition({
    content: createMemoryContentPort({ categories, correctionCategories }),
    edition,
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: { now: () => new Date('2026-10-13T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
}

const [first] = categories;
if (first === undefined) throw new Error('The pack needs Categories');

describe('the Мій Мікс screen', () => {
  it('offers every Category of the Language Pack in its order, all on in the default Mix', async () => {
    const { mix } = await open(ukrainian);

    const model = mixScreenModel({ edition: ukrainian, mix: mix.state });

    expect(model.chips.map(({ id }) => id)).toEqual(categories.map(({ id }) => id));
    expect(model.chips.map(({ name }) => name)).toEqual(
      categories.map(({ displayName }) => displayName),
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
    expect(taken.chips.filter(({ on }) => on)).toHaveLength(categories.length - 1);
    expect(taken.allOn).toBe(false);

    await mix.turnAllOn();
    const all = mixScreenModel({ edition: ukrainian, mix: mix.state });
    expect(all.chips.every(({ on }) => on)).toBe(true);
    expect(all.allOn).toBe(true);
  });

  it('disables the chip of the last Category in the Mix and says why', async () => {
    const { mix } = await open(ukrainian);
    for (const { id } of categories) {
      if (id !== first.id) await mix.takeOut(id);
    }

    const model = mixScreenModel({ edition: ukrainian, mix: mix.state });

    expect(model.chips.filter(({ disabled }) => disabled).map(({ id }) => id)).toEqual([first.id]);
    expect(model.lastCategoryHint).toBe(true);
    // The Core refuses the same thing, so the disabled chip is not the only guard.
    expect(await mix.takeOut(first.id)).toBe(false);
  });

  it.each([
    ['correction', 'corrections'],
    ['idiom', 'idioms'],
  ] as const)(
    'shows the switch of the kind %s, which takes it out of the Mix and back, only when the Edition turns it on',
    async (entryKind, feature) => {
      const without: Edition = {
        ...ukrainian,
        isFeatureEnabled: (each) => each !== feature && ukrainian.isFeatureEnabled(each),
      };
      const { mix } = await open(ukrainian);
      const switchOf = (edition: Edition) =>
        mixScreenModel({ edition, mix: mix.state }).kinds.find(
          (each) => each.entryKind === entryKind,
        );

      expect(switchOf(ukrainian)).toEqual({ entryKind, on: true });
      await mix.setKind(entryKind, false);
      expect(switchOf(ukrainian)).toEqual({ entryKind, on: false });
      await mix.setKind(entryKind, true);
      expect(switchOf(ukrainian)).toEqual({ entryKind, on: true });
      expect(switchOf(without)).toBe(undefined);
    },
  );

  it('gives the Mix kind weight of each kind, as the user sets it, only while the Edition turns the weights on', async () => {
    const without: Edition = {
      ...ukrainian,
      isFeatureEnabled: (each) => each !== 'mixKindWeights' && ukrainian.isFeatureEnabled(each),
    };
    const { mix } = await open(ukrainian);

    await mix.setKindWeight('idiom', 'more');
    await mix.setKindWeight('tip', 'less');

    expect(mixScreenModel({ edition: ukrainian, mix: mix.state }).kindWeights).toEqual({
      correction: 'normal',
      idiom: 'more',
      synonymRow: 'normal',
      tip: 'less',
    });
    expect(mixScreenModel({ edition: without, mix: mix.state }).kindWeights).toBe(undefined);
  });

  it('lists the switches in the Mix’s order: Corrections, Idioms, Synonym Rows, then Tips', async () => {
    const { mix } = await open(ukrainian);

    expect(
      mixScreenModel({ edition: ukrainian, mix: mix.state }).kinds.map(
        ({ entryKind }) => entryKind,
      ),
    ).toEqual(['correction', 'idiom', 'synonymRow', 'tip']);
  });
});

describe('the Categories of Corrections on the Мій Мікс screen', () => {
  const withoutCorrections: Edition = {
    ...ukrainian,
    isFeatureEnabled: (feature) => feature !== 'corrections' && ukrainian.isFeatureEnabled(feature),
  };

  it('offers every Category of Corrections of the Language Pack in its order, all on in the default Mix', async () => {
    const { mix } = await open(ukrainian);

    expect(mixScreenModel({ edition: ukrainian, mix: mix.state }).correctionCategories).toEqual({
      chips: correctionCategories.map(({ id, displayName }) => ({
        id,
        name: displayName,
        on: true,
        disabled: false,
      })),
      lastCategoryHint: false,
    });
  });

  it('shows a Category of Corrections taken out as off, apart from the Words’ Categories, until it is put back', async () => {
    const { mix } = await open(ukrainian);
    const onOf = () =>
      mixScreenModel({ edition: ukrainian, mix: mix.state }).correctionCategories?.chips.map(
        ({ on }) => on,
      );

    await mix.takeOut('shop', 'correction');
    expect(onOf()).toEqual([true, false, true]);
    expect(mixScreenModel({ edition: ukrainian, mix: mix.state }).allOn).toBe(true);

    await mix.putBack('shop', 'correction');
    expect(onOf()).toEqual([true, true, true]);
  });

  it('disables the chip of the last Category of Corrections in the Mix and says why', async () => {
    const { mix } = await open(ukrainian);
    await mix.takeOut('work', 'correction');
    await mix.takeOut('shop', 'correction');

    const model = mixScreenModel({ edition: ukrainian, mix: mix.state });

    expect(
      model.correctionCategories?.chips.filter(({ disabled }) => disabled).map(({ id }) => id),
    ).toEqual(['transport']);
    expect(model.correctionCategories?.lastCategoryHint).toBe(true);
    // The Words' list keeps its own last Category.
    expect(model.lastCategoryHint).toBe(false);
  });

  it('leaves them out while Corrections are out of the Mix, and brings them back as they were', async () => {
    const { mix } = await open(ukrainian);
    await mix.takeOut('shop', 'correction');

    await mix.setKind('correction', false);
    expect(mixScreenModel({ edition: ukrainian, mix: mix.state }).correctionCategories).toBe(
      undefined,
    );

    await mix.setKind('correction', true);
    expect(
      mixScreenModel({ edition: ukrainian, mix: mix.state }).correctionCategories?.chips.map(
        ({ on }) => on,
      ),
    ).toEqual([true, false, true]);
  });

  it('leaves them out while the Edition turns Corrections off', async () => {
    const { mix } = await open(ukrainian);

    expect(
      mixScreenModel({ edition: withoutCorrections, mix: mix.state }).correctionCategories,
    ).toBe(undefined);
  });
});

describe('the Rarity Floor choice of the Мій Мікс screen', () => {
  const withoutRarityFloor: Edition = {
    ...ukrainian,
    isFeatureEnabled: (feature) => feature !== 'rarityFloor' && ukrainian.isFeatureEnabled(feature),
  };

  it('offers floors from 1 to 5, on the lowest until the reader chooses one', async () => {
    const { mix } = await open(ukrainian);

    expect(mixScreenModel({ edition: ukrainian, mix: mix.state }).rarity).toEqual({
      floor: 1,
      floors: [1, 2, 3, 4, 5],
    });
  });

  it('shows the floor the reader chose', async () => {
    const { mix } = await open(ukrainian);

    await mix.setRarityFloor(4);

    expect(mixScreenModel({ edition: ukrainian, mix: mix.state }).rarity?.floor).toBe(4);
  });

  it('leaves the choice out while the rarityFloor switch is off', async () => {
    const { mix } = await open(ukrainian);

    await mix.setRarityFloor(4);

    expect(mixScreenModel({ edition: withoutRarityFloor, mix: mix.state }).rarity).toBe(undefined);
  });
});

describe('the «Мій Мікс» row of Settings', () => {
  it('says «Усі» while every Category is in the Mix, and Corrections do not change it', async () => {
    const { mix } = await open(ukrainian);

    expect(mixSummary({ mix: mix.state, strings: strings.mix, count })).toBe('Усі');
    await mix.setKind('correction', false);
    expect(mixSummary({ mix: mix.state, strings: strings.mix, count })).toBe('Усі');
  });

  it('counts the Categories in the Mix in the Edition’s plural forms', async () => {
    const { mix } = await open(ukrainian);
    const said: string[] = [];

    for (const { id } of categories.slice(1)) {
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

describe('the Rarity Ceiling choice of the Мій Мікс screen', () => {
  const withoutRarityCeiling: Edition = {
    ...ukrainian,
    isFeatureEnabled: (feature) =>
      feature !== 'rarityCeiling' && ukrainian.isFeatureEnabled(feature),
  };

  it('offers ceilings from 1 to 5, on «до 5» until the reader chooses one', async () => {
    const { mix } = await open(ukrainian);

    expect(mixScreenModel({ edition: ukrainian, mix: mix.state }).ceiling).toEqual({
      ceiling: 5,
      ceilings: [1, 2, 3, 4, 5],
    });
  });

  it('offers no ceiling below the floor and shows the one the reader chose', async () => {
    const { mix } = await open(ukrainian);

    await mix.setRarityFloor(3);
    await mix.setRarityCeiling(4);

    expect(mixScreenModel({ edition: ukrainian, mix: mix.state }).ceiling).toEqual({
      ceiling: 4,
      ceilings: [3, 4, 5],
    });
  });

  it('leaves the choice out while the rarityCeiling switch is off', async () => {
    const { mix } = await open(ukrainian);

    expect(mixScreenModel({ edition: withoutRarityCeiling, mix: mix.state }).ceiling).toBe(
      undefined,
    );
  });
});
