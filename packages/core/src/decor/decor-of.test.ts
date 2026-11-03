import type { FeatureSwitch } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { decorOf, loadDecor, loadSeasonalMotifs, parseLocalDate as on } from '../index';

/** The Mascot's accessory for a date, told apart by the width of its stroke. */
const accessory = (width: number) => ({
  shapes: [{ path: 'M0 0h1', stroke: 'ink', width }],
  replacesHat: false,
});
const motif = (width: number) => ({ accessory: accessory(width) });

/** The art of one Category, so the plain Decor is not empty. */
const categories = {
  nature: {
    pictogram: { large: { kind: 'circle', radius: 40 }, small: { kind: 'circle', radius: 10 } },
    cover: 'accent',
  },
};

const seasons = { winter: motif(20), spring: motif(21), summer: motif(22), autumn: motif(23) };
const holidays = [{ rule: { kind: 'fixed', day: 24, month: 8 }, motif: motif(30) }];

/** The Edition's plain Decor and its seasonal motifs, as the app loads them from one file. */
const file = { categories, seasons, holidays };
const decor = loadDecor(file);
const motifs = loadSeasonalMotifs(file);

const switchedOn = { isFeatureEnabled: () => true };
const seasonalOn = { seasonalDecor: true };

describe('decorOf', () => {
  it("puts the Season's accessory on the Mascot while the setting and its switch are on", () => {
    const shown = decorOf({
      decor,
      motifs,
      date: on('2026-07-10'),
      edition: switchedOn,
      settings: seasonalOn,
    });

    expect(shown.mascotAccessory).toEqual(accessory(22));
  });

  it('leaves the rest of the Decor as the Edition draws it', () => {
    const { mascotAccessory: _, ...others } = decorOf({
      decor,
      motifs,
      date: on('2026-01-15'),
      edition: switchedOn,
      settings: seasonalOn,
    });

    expect(others).toEqual({ mascot: decor.mascot, categories: decor.categories });
    expect(others.categories).toEqual(categories);
  });

  it("puts a Holiday's accessory on over its Season's", () => {
    const shown = decorOf({
      decor,
      motifs,
      date: on('2026-08-24'),
      edition: switchedOn,
      settings: seasonalOn,
    });

    expect(shown.mascotAccessory).toEqual(accessory(30));
  });

  it('changes with the local date, the day after a Holiday back to the Season', () => {
    const shown = decorOf({
      decor,
      motifs,
      date: on('2026-08-25'),
      edition: switchedOn,
      settings: seasonalOn,
    });

    expect(shown.mascotAccessory).toEqual(accessory(22));
  });

  it('gives the plain Edition Decor, with no accessory, while the setting is off', () => {
    const shown = decorOf({
      decor,
      motifs,
      date: on('2026-08-24'),
      edition: switchedOn,
      settings: { seasonalDecor: false },
    });

    expect(shown).toEqual(decor);
    expect(shown.mascotAccessory).toBeUndefined();
  });

  it('gives the plain Edition Decor while the seasonalDecor switch is off', () => {
    const edition = { isFeatureEnabled: (feature: FeatureSwitch) => feature !== 'seasonalDecor' };

    const shown = decorOf({ decor, motifs, date: on('2026-08-24'), edition, settings: seasonalOn });

    expect(shown).toEqual(decor);
  });

  it('gives the plain Decor of an Edition with no seasonal motifs', () => {
    const plain = { categories };
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
