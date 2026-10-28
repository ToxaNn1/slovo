import type { FeatureSwitch } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { decorOf, loadDecor, loadSeasonalMotifs, parseLocalDate as on } from '../index';

/** A drawing told apart by its width alone. */
const drawing = (width: number) => ({
  width,
  height: 1,
  layers: [{ path: 'M0 0h1v1H0z', light: '#000000', dark: '#FFFFFF' }],
});

/** A motif told apart by its tile's width; its centre is the tile's width plus 100. */
const motif = (width: number) => ({ tile: drawing(width), centre: drawing(width + 100) });

const plain = {
  background: { tile: drawing(1) },
  divider: { band: drawing(2), centre: drawing(3) },
  corners: { corner: drawing(4) },
  emptyState: { illustration: drawing(5), error: drawing(6) },
  splash: { mark: drawing(7), band: drawing(8) },
  victory: { illustration: drawing(9) },
  shareCard: { band: drawing(10), corner: drawing(11) },
};

const seasons = { winter: motif(20), spring: motif(21), summer: motif(22), autumn: motif(23) };
const holidays = [{ rule: { kind: 'fixed', day: 24, month: 8 }, motif: motif(30) }];

/** The Edition's plain Decor and its seasonal motifs, as the app loads them from one file. */
const file = { ...plain, seasons, holidays };
const decor = loadDecor(file);
const motifs = loadSeasonalMotifs(file);

const switchedOn = { isFeatureEnabled: () => true };
const seasonalOn = { seasonalDecor: true };

describe('decorOf', () => {
  it("shows the Season's tile and divider centre while the setting and its switch are on", () => {
    const shown = decorOf({
      decor,
      motifs,
      date: on('2026-07-10'),
      edition: switchedOn,
      settings: seasonalOn,
    });

    expect(shown.background).toEqual({ tile: motif(22).tile });
    expect(shown.divider).toEqual({ band: plain.divider.band, centre: motif(22).centre });
  });

  it('leaves every other slot as the Edition draws it', () => {
    const { background, divider, ...others } = decorOf({
      decor,
      motifs,
      date: on('2026-01-15'),
      edition: switchedOn,
      settings: seasonalOn,
    });

    expect(others).toEqual({
      corners: plain.corners,
      emptyState: plain.emptyState,
      splash: plain.splash,
      victory: plain.victory,
      shareCard: plain.shareCard,
    });
    expect(background).toEqual({ tile: motif(20).tile });
    expect(divider.band).toEqual(plain.divider.band);
  });

  it("shows a Holiday's motif over its Season's", () => {
    const shown = decorOf({
      decor,
      motifs,
      date: on('2026-08-24'),
      edition: switchedOn,
      settings: seasonalOn,
    });

    expect(shown.background).toEqual({ tile: motif(30).tile });
    expect(shown.divider.centre).toEqual(motif(30).centre);
  });

  it('changes with the local date, the day after a Holiday back to the Season', () => {
    const shown = decorOf({
      decor,
      motifs,
      date: on('2026-08-25'),
      edition: switchedOn,
      settings: seasonalOn,
    });

    expect(shown.background).toEqual({ tile: motif(22).tile });
  });

  it('shows the motif in slot 1 of an Edition that draws no background otherwise', () => {
    const { background: _, ...withoutBackground } = plain;
    const file = { ...withoutBackground, seasons };
    const shown = decorOf({
      decor: loadDecor(file),
      motifs: loadSeasonalMotifs(file),
      date: on('2026-04-01'),
      edition: switchedOn,
      settings: seasonalOn,
    });

    expect(shown.background).toEqual({ tile: motif(21).tile });
  });

  it('gives the plain Edition Decor while the setting is off', () => {
    const shown = decorOf({
      decor,
      motifs,
      date: on('2026-08-24'),
      edition: switchedOn,
      settings: { seasonalDecor: false },
    });

    expect(shown).toEqual(decor);
  });

  it('gives the plain Edition Decor while the seasonalDecor switch is off', () => {
    const edition = { isFeatureEnabled: (feature: FeatureSwitch) => feature !== 'seasonalDecor' };

    const shown = decorOf({ decor, motifs, date: on('2026-08-24'), edition, settings: seasonalOn });

    expect(shown).toEqual(decor);
  });

  it('gives the plain Decor of an Edition with no seasonal motifs', () => {
    const shown = decorOf({
      decor: loadDecor(plain),
      motifs: loadSeasonalMotifs(plain),
      date: on('2026-08-24'),
      edition: switchedOn,
      settings: seasonalOn,
    });

    expect(shown).toEqual(loadDecor(plain));
  });
});
