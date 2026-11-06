import { describe, expect, it, jest } from '@jest/globals';
import { loadEdition, type Edition, type FeatureSwitch, type UserSettings } from '@slovo/core';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider } from '../shell-value';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { LemmaPronunciation } from './pronunciation-button';

const { config } = activeEditionFiles;

const word = 'w_card';

/** The Recording of the card's Word in each Narrator Voice, as the audio module gets it. */
const cardRecordings: Record<string, number> = { oksana: 201, taras: 202 };

/** The Recordings the audio module was given, each with the call that ends its reading. */
const played: { recording: number; end: () => void }[] = [];

jest.mock('../edition/edition', () => {
  const actual = jest.requireActual<typeof import('../edition/edition')>('../edition/edition');
  return {
    ...actual,
    activeEditionFiles: {
      ...actual.activeEditionFiles,
      recordings: { oksana: { w_card: 201 }, taras: { w_card: 202 } },
    },
  };
});
jest.mock('../sounds/interface-sounds', () => ({
  ...jest.requireActual<object>('../sounds/interface-sounds'),
  recordingPlayer: {
    play: (recording: number, end: () => void) => {
      played.push({ recording, end });
    },
    stop: () => undefined,
  },
}));

/** The UA Edition as it ships, with the Feature Switches named set as given. */
function editionWith(switches: Partial<Record<FeatureSwitch, boolean>>): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, boolean> };
  return loadEdition({ ...rest, featureSwitches: { ...featureSwitches, ...switches } });
}

/** Taps the Pronunciation button of a Word card under the settings and switches given; gives the Recording it played. */
async function tapCard(
  changes: Partial<UserSettings>,
  switches: Partial<Record<FeatureSwitch, boolean>> = {},
): Promise<number | undefined> {
  const shell = testShell({
    composition: opened(await testShell().composition.opened()),
    remoteSwitches: switchedTo(editionWith(switches)),
    settings: await settingsAt(changes),
  });
  await render(
    <ShellProvider shell={shell}>
      <EditionProvider edition={edition} strings={editionStrings}>
        <SettingsProvider>
          <LemmaPronunciation lemma="заграва" entryId={word} />
        </SettingsProvider>
      </EditionProvider>
    </ShellProvider>,
  );
  played.length = 0;
  await fireEvent.press(await screen.findByTestId('word-pronunciation'));
  const reading = played[0];
  // The reading ends, so the next test starts from a silent card.
  await act(() => {
    reading?.end();
  });
  return reading?.recording;
}

describe('A Word card › Narrator Voice', () => {
  it('reads its Word in the voice the reader chose', async () => {
    expect(await tapCard({ narratorVoice: 'taras' })).toBe(cardRecordings['taras']);
  });

  it("reads its Word in the Edition's default voice while the voice switch is off", async () => {
    expect(await tapCard({ narratorVoice: 'taras' }, { narratorVoice: false })).toBe(
      cardRecordings['oksana'],
    );
  });

  it("reads its Word in the Edition's default voice for a voice the Edition does not have", async () => {
    expect(await tapCard({ narratorVoice: 'nobody' })).toBe(cardRecordings['oksana']);
  });
});
