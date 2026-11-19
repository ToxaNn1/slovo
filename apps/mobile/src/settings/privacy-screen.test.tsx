import { describe, expect, it } from '@jest/globals';
import {
  loadEdition,
  type AnalyticsPort,
  type Backend,
  type Edition,
  type FeatureSwitch,
} from '@slovo/core';
import { createFakeBackend } from '@slovo/core/testing';
import { Stack } from 'expo-router';
import { renderApp } from '../shell/test-app';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import PrivacyScreen from '../app/settings/privacy';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { type ShareFile, type SharedFile } from '../shell-value';
import {
  opened,
  recordedAnalytics,
  settingsAt,
  switchedTo,
  testShell,
} from '../shell/test-support';

const { config } = activeEditionFiles;

/** The UA Edition as it ships, with the Feature Switches named set as given. */
function editionWith(switches: Partial<Record<FeatureSwitch, boolean>>): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, string> };
  const states = Object.fromEntries(
    Object.entries(switches).map(([name, on]) => [name, on ? 'on' : 'off']),
  );
  return loadEdition({ ...rest, featureSwitches: { ...featureSwitches, ...states } });
}

/** A share window that keeps every file handed to it and is sent each one. */
function recordedShareWindow() {
  const files: SharedFile[] = [];
  const share: ShareFile = (file) => {
    files.push(file);
    return Promise.resolve('shared');
  };
  return { files, share };
}

/**
 * «Конфіденційність» as the app routes to it, over the Edition in effect with
 * the switches named set as given, signed out, with the share window given.
 * Gives the settings, which tell `analytics` of a change when a test gives a port.
 */
async function renderPrivacy({
  switches = {},
  analytics,
  backend,
  shareFile = recordedShareWindow().share,
}: {
  switches?: Partial<Record<FeatureSwitch, boolean>>;
  analytics?: AnalyticsPort;
  /** Where switching sharing off sends its one anonymous unit; nowhere unless given. */
  backend?: Pick<Backend, 'counters'>;
  shareFile?: ShareFile;
} = {}) {
  const settings = await settingsAt({}, analytics, backend);
  const shell = testShell({
    composition: opened(await testShell().composition.opened()),
    remoteSwitches: switchedTo(editionWith(switches)),
    settings,
    account: undefined,
    shareFile,
  });
  await renderApp(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      'settings/privacy': PrivacyScreen,
    },
    { shell, initialUrl: '/settings/privacy' },
  );
  return (await settings.opened()).settings;
}

const statsSwitch = () => screen.getByRole('switch', { name: 'Анонімна статистика' });

describe('Settings › «Конфіденційність»', () => {
  it('turns sharing off from its one switch, which stops Analytics and the Community Counters', async () => {
    const analytics = recordedAnalytics();
    const server = createFakeBackend();
    const settings = await renderPrivacy({ analytics: analytics.port, backend: server.backend });

    expect(statsSwitch()).toBeChecked();
    expect(screen.getByHintText(editionStrings.settings.anonymousStats.explanation)).toBe(
      statsSwitch(),
    );

    await fireEvent.press(statsSwitch());

    expect((await settings.read()).shareCounters).toBe(false);
    expect(analytics.stopped()).toBe(true);
    expect(analytics.events).toEqual([]);
    await waitFor(() => {
      expect(server.counters.statisticsOff).toEqual([
        { body: { editionId: edition.id }, session: undefined },
      ]);
    });
  });

  it('hands the Data export, built without an Account, to the share window as one JSON file', async () => {
    const window = recordedShareWindow();
    await renderPrivacy({ shareFile: window.share });

    await fireEvent.press(screen.getByRole('button', { name: 'Експортувати мої дані' }));

    await waitFor(() => {
      expect(window.files).toHaveLength(1);
    });
    const [file] = window.files;
    expect(file?.title).toBe('Мої дані SLOVO');
    expect(file?.name).toBe(`slovo-${edition.id}-data.json`);
    expect(JSON.parse(file?.text ?? '')).toMatchObject({
      format: 'slovo-data-export',
      version: 1,
      edition: edition.id,
      reader: { name: null },
    });
  });

  it('hands one file to the share window when the export is tapped again while its sheet is up', async () => {
    const files: SharedFile[] = [];
    let closed: () => void = () => undefined;
    const sheet = new Promise<'shared'>((resolve) => {
      closed = () => {
        resolve('shared');
      };
    });
    // The share sheet stays up until closed; a second sheet would be refused.
    const share: ShareFile = (file) => {
      files.push(file);
      return files.length === 1 ? sheet : Promise.reject(new Error('A sheet is already up'));
    };
    await renderPrivacy({ shareFile: share });

    const row = () => screen.getByRole('button', { name: 'Експортувати мої дані' });
    await fireEvent.press(row());
    await waitFor(() => {
      expect(files).toHaveLength(1);
    });
    await fireEvent.press(row());
    await act(async () => {
      closed();
      await sheet;
    });

    expect(files).toHaveLength(1);
    expect(screen.queryByText('Не вдалося зібрати файл. Спробуй ще раз.')).not.toBeOnTheScreen();
  });

  it('says so when the file could not be made', async () => {
    await renderPrivacy({ shareFile: () => Promise.reject(new Error('No space left')) });

    await fireEvent.press(screen.getByRole('button', { name: 'Експортувати мої дані' }));

    expect(await screen.findByText('Не вдалося зібрати файл. Спробуй ще раз.')).toBeOnTheScreen();
  });

  it('has no export row with the Data export off, and still shows the switch', async () => {
    await renderPrivacy({ switches: { dataExport: false } });

    expect(statsSwitch()).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Експортувати мої дані' })).not.toBeOnTheScreen();
  });
});

describe('Privacy › its header (app pass 91)', () => {
  it('keeps the back header above the list, so it stays put under the status bar while the list scrolls', async () => {
    await renderPrivacy();

    expect(
      screen.getByRole('header', { name: editionStrings.settings.privacy.title }),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('privacy-scroll')).queryByRole('header', {
        name: editionStrings.settings.privacy.title,
      }),
    ).toBeNull();
  });
});
