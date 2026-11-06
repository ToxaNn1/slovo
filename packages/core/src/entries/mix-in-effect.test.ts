import { describe, expect, it } from 'vitest';

import { openComposition, type Composition, type HideOption } from '../index';
import { createMemoryContentPort } from '../testing';
import type { Category, FeatureSwitch } from '@slovo/contracts';
import { correction, fakeClock, idiom, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

const category = (id: string, displayName: string): Category => ({
  id,
  displayName,
  description: `${displayName}.`,
  tone: 'loud',
});
/** The Language Pack's Categories of Words and of Corrections, in its order. */
const nature = category('nature', 'Nature');
const speech = category('speech', 'Speech');
const work = category('work', 'At work');
const shop = category('shop', 'In the shop');

const content = createMemoryContentPort({
  categories: [nature, speech],
  words: [word('w_nature', { categoryId: nature.id }), word('w_speech', { categoryId: speech.id })],
  correctionCategories: [work, shop],
  corrections: [
    correction('c_work', { categoryId: work.id }),
    correction('c_shop', { categoryId: shop.id }),
  ],
  idioms: [idiom('i_one')],
});

/** The Core composition with the Feature Switches in effect: Corrections and Idioms on unless turned off. */
async function run({ off = [] }: { off?: readonly FeatureSwitch[] } = {}): Promise<Composition> {
  const on: readonly FeatureSwitch[] = ['corrections', 'idioms', 'mixKindWeights'];
  return openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: (feature) => on.includes(feature) && !off.includes(feature),
    }),
    userState: await openUserState({ port: createMemoryUserStatePort() }),
    clock: fakeClock().clock,
    random: { next: () => 0.25 },
  });
}

const entryOption = (entryId: string): HideOption => ({
  kind: 'entry',
  target: { kind: 'entry', entryId },
});

describe('the hide options of an Entry', () => {
  it('offer a Word and its Category, the Words’ list taking no `of`', async () => {
    const { mix } = await run();
    expect(mix.hideOptions({ kind: 'word', entryId: 'w_nature', categoryId: nature.id })).toEqual([
      entryOption('w_nature'),
      { kind: 'category', target: { kind: 'category', categoryId: nature.id }, category: nature },
    ]);
  });

  it('leave out the last Category of Words in the Mix (ADR 0019)', async () => {
    const { mix } = await run();
    await mix.takeOut(speech.id);
    expect(mix.hideOptions({ kind: 'word', entryId: 'w_nature', categoryId: nature.id })).toEqual([
      entryOption('w_nature'),
    ]);
  });

  it('leave out a Category out of the Mix already and one the Language Pack does not have', async () => {
    const { mix } = await run();
    await mix.takeOut(speech.id);
    expect(mix.hideOptions({ kind: 'word', entryId: 'w_speech', categoryId: speech.id })).toEqual([
      entryOption('w_speech'),
    ]);
    expect(mix.hideOptions({ kind: 'word', entryId: 'w_x', categoryId: 'gone' })).toEqual([
      entryOption('w_x'),
    ]);
  });

  it('offer a Correction, its Category of Corrections and Corrections as a whole', async () => {
    const { mix } = await run();
    expect(mix.hideOptions({ kind: 'correction', entryId: 'c_work', categoryId: work.id })).toEqual(
      [
        entryOption('c_work'),
        {
          kind: 'category',
          target: { kind: 'category', categoryId: work.id, of: 'correction' },
          category: work,
        },
        { kind: 'whole-kind', target: { kind: 'whole-kind', entryKind: 'correction' } },
      ],
    );
  });

  it('offer the last Category of Corrections as the last one, which can’t be chosen, beside Corrections as a whole', async () => {
    const { mix } = await run();
    await mix.takeOut(shop.id, 'correction');
    expect(mix.hideOptions({ kind: 'correction', entryId: 'c_work', categoryId: work.id })).toEqual(
      [
        entryOption('c_work'),
        {
          kind: 'last-category',
          target: { kind: 'category', categoryId: work.id, of: 'correction' },
          category: work,
        },
        { kind: 'whole-kind', target: { kind: 'whole-kind', entryKind: 'correction' } },
      ],
    );
  });

  it('offer an Idiom and Idioms as a whole', async () => {
    const { mix } = await run();
    expect(mix.hideOptions({ kind: 'idiom', entryId: 'i_one' })).toEqual([
      entryOption('i_one'),
      { kind: 'whole-kind', target: { kind: 'whole-kind', entryKind: 'idiom' } },
    ]);
  });

  it('offer only the Entry of a kind out of the Mix or switched off', async () => {
    const outOfMix = await run();
    await outOfMix.mix.setKind('idiom', false);
    expect(outOfMix.mix.hideOptions({ kind: 'idiom', entryId: 'i_one' })).toEqual([
      entryOption('i_one'),
    ]);
    const { mix } = await run({ off: ['corrections'] });
    expect(mix.hideOptions({ kind: 'correction', entryId: 'c_work', categoryId: work.id })).toEqual(
      [entryOption('c_work')],
    );
  });
});

describe('what is out of the Mix, for the Hidden screen', () => {
  it('is nothing at first', async () => {
    const { mix } = await run();
    expect(mix.outOfMix()).toEqual({ categories: [], kinds: [] });
  });

  it('lists the Hidden Categories, the Words’ and then the Corrections’, and the kinds out as a whole', async () => {
    const { mix } = await run();
    await mix.takeOut(shop.id, 'correction');
    await mix.takeOut(speech.id);
    await mix.setKind('idiom', false);
    expect(mix.outOfMix()).toEqual({
      categories: [
        { of: 'word', category: speech },
        { of: 'correction', category: shop },
      ],
      kinds: ['idiom'],
    });
  });

  it('leaves out the Categories of Corrections while Corrections are out of the Mix as a whole', async () => {
    const { mix } = await run();
    await mix.takeOut(shop.id, 'correction');
    await mix.setKind('correction', false);
    expect(mix.outOfMix()).toEqual({ categories: [], kinds: ['correction'] });
  });

  it('leaves out everything of a kind switched off', async () => {
    const { mix } = await run({ off: ['corrections', 'idioms'] });
    await mix.takeOut(shop.id, 'correction');
    await mix.setKind('correction', false);
    await mix.setKind('idiom', false);
    expect(mix.outOfMix()).toEqual({ categories: [], kinds: [] });
  });
});

describe('the Mix screen', () => {
  it('starts with every chip in, «Усі» on, the kinds switched on and their weights', async () => {
    const { mix } = await run();
    expect(mix.screen()).toEqual({
      categories: [
        { category: nature, place: 'in' },
        { category: speech, place: 'in' },
      ],
      allOn: true,
      kinds: [
        { entryKind: 'correction', on: true },
        { entryKind: 'idiom', on: true },
      ],
      correctionCategories: [
        { category: work, place: 'in' },
        { category: shop, place: 'in' },
      ],
      kindWeights: mix.state.kindWeights,
    });
  });

  it('gives the last Category of each list in the Mix as the last one, whose chip can’t be turned off (ADR 0019)', async () => {
    const { mix } = await run();
    await mix.takeOut(speech.id);
    await mix.takeOut(work.id, 'correction');
    const screen = mix.screen();
    expect(screen.categories).toEqual([
      { category: nature, place: 'last' },
      { category: speech, place: 'out' },
    ]);
    expect(screen.allOn).toBe(false);
    expect(screen.correctionCategories).toEqual([
      { category: work, place: 'out' },
      { category: shop, place: 'last' },
    ]);
  });

  it('leaves out the chips of Corrections while Corrections are out of the Mix', async () => {
    const { mix } = await run();
    await mix.setKind('correction', false);
    const screen = mix.screen();
    expect(screen.kinds).toEqual([
      { entryKind: 'correction', on: false },
      { entryKind: 'idiom', on: true },
    ]);
    expect(screen.correctionCategories).toBeUndefined();
  });

  it('leaves out a kind switched off, its chips, and the weights while their switch is off', async () => {
    const { mix } = await run({ off: ['corrections', 'mixKindWeights'] });
    const screen = mix.screen();
    expect(screen.kinds).toEqual([{ entryKind: 'idiom', on: true }]);
    expect(screen.correctionCategories).toBeUndefined();
    expect(screen.kindWeights).toBeUndefined();
  });
});
