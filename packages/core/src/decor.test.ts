import { describe, expect, it } from 'vitest';

import { coreDecor, InvalidDecorError, loadDecor } from './index';

const stitch = (light: string, dark: string) => ({
  width: 4,
  height: 4,
  layers: [{ path: 'M0 0h2v2H0z', light, dark }],
});

const editionDecor = {
  background: { tile: stitch('rgba(163, 34, 27, 0.05)', 'rgba(212, 174, 92, 0.06)') },
  divider: { band: stitch('#A3221B', '#D4AE5C'), centre: stitch('#1E1813', '#C8372D') },
  corners: { corner: stitch('#9C7A2E', '#D4AE5C') },
  emptyState: {
    illustration: stitch('#A3221B', '#D4AE5C'),
    error: stitch('#A3221B', '#D4AE5C'),
  },
  splash: { mark: stitch('#A3221B', '#D4AE5C'), band: stitch('#A3221B', '#D4AE5C') },
  victory: { illustration: stitch('#A3221B', '#D4AE5C') },
  shareCard: { band: stitch('#A3221B', '#D4AE5C'), corner: stitch('#9C7A2E', '#D4AE5C') },
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
    const { background, corners, emptyState, splash, victory, shareCard } = coreDecor;

    expect({ background, corners, emptyState, splash, victory, shareCard }).toEqual({
      background: undefined,
      corners: undefined,
      emptyState: undefined,
      splash: undefined,
      victory: undefined,
      shareCard: undefined,
    });
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

  it('has no error illustration when the Edition supplies only the empty-state one', () => {
    const decor = loadDecor({ emptyState: { illustration: editionDecor.emptyState.illustration } });

    expect(decor.emptyState?.error).toBeUndefined();
  });

  const layer = { path: 'M0 0h2v2H0z', light: '#000000', dark: '#FFFFFF' };
  const motif = (override: object) => ({ width: 2, height: 2, layers: [layer], ...override });

  it.each([
    [
      'a colour that is not #RRGGBB or rgba()',
      { corners: { corner: motif({ layers: [{ ...layer, dark: 'gold' }] }) } },
      'corners.corner.layers.0.dark',
    ],
    [
      'a layer without its dark colour',
      { corners: { corner: motif({ layers: [{ path: layer.path, light: '#000000' }] }) } },
      'corners.corner.layers.0.dark',
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
    ['an unknown slot', { frame: {} }, '(root)'],
  ])('rejects %s, naming the field', (_, decor, field) => {
    const load = () => loadDecor(decor);

    expect(load).toThrow(InvalidDecorError);
    expect(load).toThrow(`\n${field}: `);
  });
});
