import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { DecorMotif } from '@slovo/contracts';
import type { Clock } from '@slovo/core';
import { DecorBackground, EditionProvider, FontSizePreview, TokensProvider } from '@slovo/ui';
import { act, render, screen } from '@testing-library/react-native';

import {
  edition,
  editionDecor,
  editionStrings,
  editionTokens,
  seasonalMotifs,
} from '../edition/edition';
import { DecorInEffect } from './decor-in-effect';

// The Decor reads the Feature Switches in effect and the settings through these.
let mockSeasonalDecor = true;
jest.mock('../settings/settings', () => ({
  useSettings: () => ({ current: { seasonalDecor: mockSeasonalDecor }, update: () => undefined }),
}));
jest.mock('../edition/remote-switches', () => ({
  useEditionInEffect: () => ({ isFeatureEnabled: () => true }),
}));

/** The Ukrainian Edition's plain Decor and its motifs. */
const { background, divider } = editionDecor;
if (background === undefined || seasonalMotifs === undefined) {
  throw new Error('The Edition has a background and seasonal motifs');
}
const { seasons, holidays } = seasonalMotifs;
const independenceDay = holidays.find(
  ({ rule }) => rule.kind === 'fixed' && rule.month === 8 && rule.day === 24,
)?.motif;

/** A clock in Kyiv that reads the system time, which the tests set. */
const kyiv: Clock = { now: () => new Date(), timeZone: () => 'Europe/Kyiv' };

/** Every path drawn on the screen, in order. */
function drawnPaths(): string[] {
  const paths: string[] = [];
  const visit = (node: unknown) => {
    if (typeof node !== 'object' || node === null) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const { props, children } = node as { props?: { d?: unknown }; children?: unknown };
    if (typeof props?.d === 'string') paths.push(props.d);
    visit(children);
  };
  visit(screen.toJSON());
  return paths;
}

const pathsOf = ({ layers }: DecorMotif) => layers.map(({ path }) => path);

/** The screen background and a divided card under the Decor in effect at the system time. */
async function renderDecor() {
  await render(
    <EditionProvider edition={edition} strings={editionStrings}>
      <TokensProvider tokens={editionTokens} colorScheme="light">
        <DecorInEffect clock={kyiv}>
          <DecorBackground />
          <FontSizePreview lemma="Лемá" definition="Тлумачення" />
        </DecorInEffect>
      </TokensProvider>
    </EditionProvider>,
  );
}

describe('the Decor in effect', () => {
  afterEach(() => {
    jest.useRealTimers();
    mockSeasonalDecor = true;
  });

  it('draws the winter tile and centre on a winter day', async () => {
    jest.useFakeTimers({ now: new Date('2027-01-15T12:00:00+02:00') });
    await renderDecor();

    expect(drawnPaths()).toEqual(
      expect.arrayContaining([...pathsOf(seasons.winter.tile), ...pathsOf(seasons.winter.centre)]),
    );
    expect(drawnPaths()).not.toEqual(expect.arrayContaining(pathsOf(background.tile)));
  });

  it('draws the ribbon of 24 August over the summer motif', async () => {
    if (independenceDay === undefined) throw new Error('The Edition lists no 24 August');
    jest.useFakeTimers({ now: new Date('2027-08-24T09:00:00+03:00') });
    await renderDecor();

    expect(drawnPaths()).toEqual(
      expect.arrayContaining([
        ...pathsOf(independenceDay.tile),
        ...pathsOf(independenceDay.centre),
      ]),
    );
    expect(drawnPaths()).not.toEqual(expect.arrayContaining(pathsOf(seasons.summer.tile)));
  });

  it('turns to the ribbon at local midnight before 24 August', async () => {
    if (independenceDay === undefined) throw new Error('The Edition lists no 24 August');
    jest.useFakeTimers({ now: new Date('2027-08-23T23:59:00+03:00') });
    await renderDecor();
    expect(drawnPaths()).toEqual(expect.arrayContaining(pathsOf(seasons.summer.tile)));

    await act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    expect(drawnPaths()).toEqual(expect.arrayContaining(pathsOf(independenceDay.tile)));
    expect(drawnPaths()).not.toEqual(expect.arrayContaining(pathsOf(seasons.summer.tile)));
  });

  it('draws the plain Decor with «Сезонний декор» off', async () => {
    mockSeasonalDecor = false;
    jest.useFakeTimers({ now: new Date('2027-01-15T12:00:00+02:00') });
    await renderDecor();

    expect(drawnPaths()).toEqual(
      expect.arrayContaining([...pathsOf(background.tile), ...pathsOf(divider.centre)]),
    );
    expect(drawnPaths()).not.toEqual(expect.arrayContaining(pathsOf(seasons.winter.tile)));
  });
});
