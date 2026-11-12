import { describe, expect, it, jest } from '@jest/globals';
import type { RecordingRow } from '@slovo/contracts';
import { loadEdition, type Edition, type FeatureSwitch, type UserSettings } from '@slovo/core';
import { EditionProvider } from '@slovo/ui';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderInGestureRoot } from '../shell/test-render';

import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { SettingsProvider, useSettings } from '../settings/settings';
import { ShellProvider } from '../shell-value';
import { opened, packWithMedia, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { LemmaPronunciation, useSampleReading } from './pronunciation-button';

const { config } = activeEditionFiles;

const word = 'w_card';

/** The Recording of the card's Word in each Narrator Voice, as the audio module gets it. */
const cardRecordings: Record<string, number> = { oksana: 201, taras: 202 };

/** The live Recording row of a Word in a Narrator Voice, whose file the app bundles. */
function bundledRow(wordId: string, narratorVoice: string): RecordingRow {
  return {
    wordId,
    narratorVoice,
    recordingKind: 'plain',
    hash: 'h'.repeat(64),
    size: 1_000,
    durationMs: 900,
    retired: false,
  };
}

/** The pack of the test: the card's Word in two voices and the sample Word in the default one. */
const pack = () =>
  packWithMedia({
    recordings: [
      bundledRow(word, 'oksana'),
      bundledRow(word, 'taras'),
      bundledRow(edition.narratorVoiceSample.word, 'oksana'),
    ],
  });

/** The Recordings the audio module plays, each with the call that ends its reading; a stop clears them. */
const played: { recording: number; end: () => void }[] = [];

jest.mock('../edition/edition', () => {
  const actual = jest.requireActual<typeof import('../edition/edition')>('../edition/edition');
  return {
    ...actual,
    activeEditionFiles: {
      ...actual.activeEditionFiles,
      // Bundled by Media Store path, each the file of a row of `packWithMedia` below, hash `h…`.
      starterMedia: {
        [`recordings/oksana/plain/w_card.${'h'.repeat(64)}.mp3`]: 201,
        [`recordings/taras/plain/w_card.${'h'.repeat(64)}.mp3`]: 202,
        [`recordings/oksana/plain/${actual.edition.narratorVoiceSample.word}.${'h'.repeat(64)}.mp3`]: 301,
      },
    },
  };
});
jest.mock('../sounds/interface-sounds', () => ({
  ...jest.requireActual<object>('../sounds/interface-sounds'),
  recordingPlayer: {
    play: (recording: number, end: () => void) => {
      played.push({ recording, end });
    },
    stop: () => {
      played.length = 0;
    },
  },
}));

/** The UA Edition as it ships, with the Feature Switches named set as given. */
function editionWith(switches: Partial<Record<FeatureSwitch, boolean>>): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, string> };
  const states = Object.fromEntries(
    Object.entries(switches).map(([name, on]) => [name, on ? 'on' : 'off']),
  );
  return loadEdition({ ...rest, featureSwitches: { ...featureSwitches, ...states } });
}

/** Taps the Pronunciation button of a Word card under the settings and switches given; gives the Recording it played. */
async function tapCard(
  changes: Partial<UserSettings>,
  switches: Partial<Record<FeatureSwitch, boolean>> = {},
): Promise<number | undefined> {
  const shell = testShell({
    composition: opened(await testShell().composition.opened()),
    languagePack: pack(),
    remoteSwitches: switchedTo(editionWith(switches)),
    settings: await settingsAt(changes),
  });
  await renderInGestureRoot(
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

/** The voice screen's sample, read from one button, beside a «Звуки» switch. */
function SampleWithSounds() {
  const sample = useSampleReading();
  const { update } = useSettings();
  return (
    <>
      <Pressable testID="sample" onPress={sample.toggle}>
        <Text>{sample.playing ? 'playing' : 'idle'}</Text>
      </Pressable>
      <Pressable
        testID="sounds-off"
        onPress={() => {
          update({ sounds: false });
        }}
      />
    </>
  );
}

describe('The voice screen › «Звуки»', () => {
  it('stops the sample Word when «Звуки» go off while it reads', async () => {
    const shell = testShell({
      composition: opened(await testShell().composition.opened()),
      languagePack: pack(),
      remoteSwitches: switchedTo(editionWith({})),
      settings: await settingsAt({}),
    });
    await renderInGestureRoot(
      <ShellProvider shell={shell}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <SettingsProvider>
            <SampleWithSounds />
          </SettingsProvider>
        </EditionProvider>
      </ShellProvider>,
    );
    played.length = 0;
    await fireEvent.press(await screen.findByTestId('sample'));
    expect(screen.getByText('playing')).toBeOnTheScreen();
    expect(played.map(({ recording }) => recording)).toEqual([301]);

    await fireEvent.press(screen.getByTestId('sounds-off'));

    expect(await screen.findByText('idle')).toBeOnTheScreen();
    expect(played).toEqual([]);
  });
});
