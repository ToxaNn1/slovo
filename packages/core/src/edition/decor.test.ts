import { describe, expect, it } from 'vitest';

import { coreDecor, loadDecor } from '../index';
import { InvalidDecorError } from './decor';

const editionDecor = {
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

  it('draws nothing of its own', () => {
    expect(coreDecor).toEqual({
      mascot: undefined,
      mascotAccessory: undefined,
      categories: undefined,
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

  it('draws no Category art for an Edition that supplies none', () => {
    expect(loadDecor({}).categories).toBeUndefined();
  });

  it('takes the art of each Category an Edition supplies', () => {
    expect(loadDecor({ categories: editionDecor.categories }).categories).toEqual(
      editionDecor.categories,
    );
  });

  const categoryArt = (pictogram: object, cover = 'tile') => ({
    categories: {
      science: { pictogram: { small: { kind: 'circle', radius: 50 }, ...pictogram }, cover },
    },
  });
  const accessory = { shapes: [{ path: 'M0 0h1', stroke: 'ink', width: 1 }], replacesHat: false };
  const season = { accessory };
  const seasons = { winter: season, spring: season, summer: season, autumn: season };
  const motif = { width: 2, height: 2, layers: [{ path: 'M0 0h2v2H0z', color: 'decor' }] };

  it.each<[name: string, decor: unknown, field: string]>([
    ...['background', 'divider', 'corners', 'emptyState', 'splash', 'victory', 'shareCard'].map(
      (slot): [string, unknown, string] => [
        `the removed ornament slot ${slot}`,
        { [slot]: { motif } },
        '(root)',
      ],
    ),
    [
      'a Season motif with the removed tile and centre',
      { seasons: { ...seasons, winter: { ...season, tile: motif, centre: motif } } },
      'seasons.winter',
    ],
    [
      'a Season motif without its accessory',
      { seasons: { ...seasons, spring: {} } },
      'seasons.spring.accessory',
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
