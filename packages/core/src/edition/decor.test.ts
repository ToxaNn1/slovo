import { describe, expect, it } from 'vitest';

import { coreDecor, loadDecor } from '../index';
import { InvalidDecorError } from './decor';

const stitch = (color: string, opacity?: number) => ({
  width: 4,
  height: 4,
  layers: [{ path: 'M0 0h2v2H0z', color, ...(opacity === undefined ? {} : { opacity }) }],
});

const editionDecor = {
  background: { tile: stitch('decor', 0.06) },
  divider: { band: stitch('decor'), centre: stitch('ink') },
  corners: { corner: stitch('muted') },
  emptyState: {
    illustration: stitch('decor'),
    error: stitch('decor'),
  },
  splash: { mark: stitch('decor'), band: stitch('decor') },
  victory: { illustration: stitch('decor') },
  shareCard: { band: stitch('decor'), corner: stitch('muted') },
  categories: {
    'repressed-words': {
      pictogram: {
        large: {
          kind: 'polygon',
          points: [
            [20, 0],
            [80, 0],
            [80, 100],
            [20, 100],
          ],
        },
        small: { kind: 'circle', radius: 50 },
      },
      cover: 'quiet',
    },
  },
};

describe('loadDecor', () => {
  it('gives an Edition without Decor the Core neutral Decor', () => {
    expect(loadDecor(undefined)).toEqual(coreDecor);
    expect(loadDecor({})).toEqual(coreDecor);
  });

  it('draws the Core divider as a thin line with a small dot in the middle', () => {
    const { band, centre } = coreDecor.divider;

    expect(band.height).toBe(1);
    expect([centre.width, centre.height]).toEqual([5, 5]);
  });

  it('leaves the slots the Core shows nothing in empty', () => {
    const { background, corners, emptyState, splash, victory, shareCard, mascot } = coreDecor;

    expect({ background, corners, emptyState, splash, victory, shareCard, mascot }).toEqual({
      background: undefined,
      corners: undefined,
      emptyState: undefined,
      splash: undefined,
      victory: undefined,
      shareCard: undefined,
      mascot: undefined,
    });
  });

  it("takes the Mascot's vector an Edition supplies, and wears no accessory by itself", () => {
    const part = [{ path: 'M0 0h1v1H0z', fill: 'body' }];
    const mascot = {
      width: 10,
      height: 8,
      pivot: [5, 8],
      figure: part,
      shine: part,
      eyes: Object.fromEntries(
        [
          'sleeps',
          'waits',
          'shouts',
          'happy',
          'surprised',
          'cringes',
          'sad',
          'celebrates',
          'hatOff',
        ].map((state) => [state, part]),
      ),
      hat: part,
      hatOnGround: part,
      rays: part,
      confetti: part,
      sleepMarks: part,
    };

    const decor = loadDecor({ mascot });

    expect(decor.mascot).toEqual(mascot);
    expect(decor.mascotAccessory).toBeUndefined();
  });

  it('refuses a Mascot without the eyes of every state', () => {
    const part = [{ path: 'M0 0h1v1H0z', fill: 'body' }];
    const mascot = {
      width: 10,
      height: 8,
      pivot: [5, 8],
      figure: part,
      shine: part,
      eyes: { waits: part },
      hat: part,
      hatOnGround: part,
      rays: part,
      confetti: part,
      sleepMarks: part,
    };

    expect(() => loadDecor({ mascot })).toThrow(InvalidDecorError);
  });

  it('gives an Edition without a Share Card frame a plain Share Card', () => {
    expect(loadDecor({ corners: editionDecor.corners }).shareCard).toBeUndefined();
  });

  it('takes the Share Card frame an Edition supplies', () => {
    expect(loadDecor({ shareCard: editionDecor.shareCard }).shareCard).toEqual(
      editionDecor.shareCard,
    );
  });

  it('shows no victory illustration for an Edition that supplies none', () => {
    expect(loadDecor({ corners: editionDecor.corners }).victory).toBeUndefined();
  });

  it('takes the victory illustration an Edition supplies', () => {
    expect(loadDecor({ victory: editionDecor.victory }).victory).toEqual(editionDecor.victory);
  });

  it('takes every slot the Edition supplies', () => {
    expect(loadDecor(editionDecor)).toEqual(editionDecor);
  });

  it('keeps the Core default of each slot the Edition leaves out', () => {
    const decor = loadDecor({ corners: editionDecor.corners });

    expect(decor.corners).toEqual(editionDecor.corners);
    expect(decor.divider).toEqual(coreDecor.divider);
    expect(decor.background).toBeUndefined();
  });

  it('draws no Category art for an Edition that supplies none', () => {
    expect(loadDecor({ corners: editionDecor.corners }).categories).toBeUndefined();
  });

  it('takes the art of each Category an Edition supplies', () => {
    expect(loadDecor({ categories: editionDecor.categories }).categories).toEqual(
      editionDecor.categories,
    );
  });

  it('has no error illustration when the Edition supplies only the empty-state one', () => {
    const decor = loadDecor({ emptyState: { illustration: editionDecor.emptyState.illustration } });

    expect(decor.emptyState?.error).toBeUndefined();
  });

  const layer = { path: 'M0 0h2v2H0z', color: 'decor' };
  const categoryArt = (pictogram: object, cover = 'tile') => ({
    categories: {
      science: { pictogram: { small: { kind: 'circle', radius: 50 }, ...pictogram }, cover },
    },
  });
  const motif = (override: object) => ({ width: 2, height: 2, layers: [layer], ...override });

  it.each([
    [
      'a layer in its own hex instead of a colour role',
      { corners: { corner: motif({ layers: [{ ...layer, color: '#FF3B2F' }] }) } },
      'corners.corner.layers.0.color',
    ],
    [
      'a layer in a removed colour role',
      { corners: { corner: motif({ layers: [{ ...layer, color: 'inkSecondary' }] }) } },
      'corners.corner.layers.0.color',
    ],
    [
      'a layer in its own light and dark colours',
      {
        corners: {
          corner: motif({ layers: [{ path: layer.path, light: '#000000', dark: '#FFFFFF' }] }),
        },
      },
      'corners.corner.layers.0',
    ],
    [
      'a layer drawn at no opacity',
      { corners: { corner: motif({ layers: [{ ...layer, opacity: 0 }] }) } },
      'corners.corner.layers.0.opacity',
    ],
    [
      'a path that is not SVG path data',
      { background: { tile: motif({ layers: [{ ...layer, path: '<rect/>' }] }) } },
      'background.tile.layers.0.path',
    ],
    [
      'a motif without layers',
      { background: { tile: motif({ layers: [] }) } },
      'background.tile.layers',
    ],
    ['a motif of no width', { background: { tile: motif({ width: 0 }) } }, 'background.tile.width'],
    ['a divider without its centre', { divider: { band: motif({}) } }, 'divider.centre'],
    ['a victory slot without its illustration', { victory: {} }, 'victory.illustration'],
    [
      'a victory illustration that is not a motif',
      { victory: { illustration: motif({ layers: [] }) } },
      'victory.illustration.layers',
    ],
    [
      'a Share Card frame without its corner',
      { shareCard: { band: motif({}) } },
      'shareCard.corner',
    ],
    [
      'a Share Card band that is not a motif',
      { shareCard: { band: motif({ height: -1 }), corner: motif({}) } },
      'shareCard.band.height',
    ],
    [
      'a pictogram polygon of two points',
      categoryArt({
        large: {
          kind: 'polygon',
          points: [
            [0, 0],
            [100, 100],
          ],
        },
      }),
      'categories.science.pictogram.large.points',
    ],
    [
      'a pictogram point outside its grid',
      categoryArt({
        large: {
          kind: 'polygon',
          points: [
            [0, 0],
            [120, 0],
            [0, 100],
          ],
        },
      }),
      'categories.science.pictogram.large.points.1.0',
    ],
    [
      'a pictogram circle wider than its grid',
      categoryArt({ large: { kind: 'circle', radius: 60 } }),
      'categories.science.pictogram.large.radius',
    ],
    [
      'a Category cover the Theme has no colours for',
      categoryArt({ large: { kind: 'circle', radius: 45 } }, 'gold'),
      'categories.science.cover',
    ],
    ['an unknown slot', { frame: {} }, '(root)'],
  ])('rejects %s, naming the field', (_, decor, field) => {
    const load = () => loadDecor(decor);

    expect(load).toThrow(InvalidDecorError);
    expect(load).toThrow(`\n${field}: `);
  });
});
