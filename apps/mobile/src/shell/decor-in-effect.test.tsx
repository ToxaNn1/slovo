import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { SeasonalMotif } from '@slovo/contracts';
import { loadEdition, type Clock } from '@slovo/core';
import { EditionProvider, Mascot, TokensProvider } from '@slovo/ui';
import { act, screen } from '@testing-library/react-native';
import { renderInGestureRoot } from './test-render';

import {
  activeEditionFiles,
  edition,
  editionStrings,
  editionTokens,
  seasonalMotifs,
} from '../edition/edition';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider } from '../shell-value';
import { DecorInEffect } from './decor-in-effect';
import { settingsAt, switchedTo, testShell } from './test-support';

const { config } = activeEditionFiles;

/** The UA Edition's seasonal motifs. */
if (seasonalMotifs === undefined) throw new Error('The Edition has seasonal motifs');
const { seasons, holidays } = seasonalMotifs;
const independenceDay = holidays.find(
  ({ rule }) => rule.kind === 'fixed' && rule.month === 8 && rule.day === 24,
)?.motif;

/** A clock in Kyiv that reads the system time, which the tests set. */
const kyiv: Clock = { now: () => new Date(), timeZone: () => 'Europe/Kyiv' };

/** The paths of the accessory the Mascot wears, empty when it wears none. */
function accessoryPaths(): string[] {
  return screen
    .queryAllByTestId(/^mascot-accessory-\d+$/, { includeHiddenElements: true })
    .map((path) => path.props['d'] as string);
}

const pathsOf = ({ accessory }: SeasonalMotif) => accessory.shapes.map(({ path }) => path);

/** The UA Edition as it ships, with its Seasonal Decor Feature Switch set as given. */
function editionWithSeasonalDecor(on: boolean) {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, string> };
  return loadEdition({ ...rest, featureSwitches: { ...featureSwitches, seasonalDecor: on } });
}

/**
 * The Mascot under the Decor in effect at the system time, over the Edition with its Seasonal Decor Feature Switch on
 * (unless `editionInEffect` is given) and «Сезонний декор» as set.
 */
async function renderDecor({
  seasonalDecor = true,
  editionInEffect = editionWithSeasonalDecor(true),
} = {}) {
  const shell = testShell({
    remoteSwitches: switchedTo(editionInEffect),
    settings: await settingsAt({ seasonalDecor }),
  });
  await renderInGestureRoot(
    <ShellProvider shell={shell}>
      <EditionProvider edition={edition} strings={editionStrings}>
        <TokensProvider tokens={editionTokens} colorScheme="light">
          <SettingsProvider>
            <DecorInEffect clock={kyiv}>
              <Mascot state="waits" />
            </DecorInEffect>
          </SettingsProvider>
        </TokensProvider>
      </EditionProvider>
    </ShellProvider>,
  );
}

describe('the Decor in effect', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('puts the winter accessory on the Mascot on a winter day', async () => {
    jest.useFakeTimers({ now: new Date('2027-01-15T12:00:00+02:00') });
    await renderDecor();

    expect(accessoryPaths()).toEqual(pathsOf(seasons.winter));
  });

  it('puts the ribbon of 24 August on the Mascot over the summer accessory', async () => {
    if (independenceDay === undefined) throw new Error('The Edition lists no 24 August');
    jest.useFakeTimers({ now: new Date('2027-08-24T09:00:00+03:00') });
    await renderDecor();

    expect(accessoryPaths()).toEqual(pathsOf(independenceDay));
  });

  it('turns to the ribbon at local midnight before 24 August', async () => {
    if (independenceDay === undefined) throw new Error('The Edition lists no 24 August');
    jest.useFakeTimers({ now: new Date('2027-08-23T23:59:00+03:00') });
    await renderDecor();
    expect(accessoryPaths()).toEqual(pathsOf(seasons.summer));

    await act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    expect(accessoryPaths()).toEqual(pathsOf(independenceDay));
  });

  it('leaves the Mascot without an accessory with «Сезонний декор» off', async () => {
    jest.useFakeTimers({ now: new Date('2027-01-15T12:00:00+02:00') });
    await renderDecor({ seasonalDecor: false });

    expect(accessoryPaths()).toEqual([]);
  });

  it('leaves the Mascot without an accessory in the UA Edition as it ships, which pauses Seasonal Decor', async () => {
    jest.useFakeTimers({ now: new Date('2027-01-15T12:00:00+02:00') });
    await renderDecor({ editionInEffect: edition });

    expect(accessoryPaths()).toEqual([]);
  });
});
