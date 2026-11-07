import { describe, expect, it, jest } from '@jest/globals';
import type { FeatureSwitch, InterfaceSound } from '@slovo/core';
import { EditionProvider, fill, InterfaceSoundsProvider } from '@slovo/ui';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { BadgesScreen } from './badges-screen';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** The Interface sounds the screen played, in order. */
let played: InterfaceSound[] = [];

/**
 * The Badges screen over the Core's composition of a test Shell, as the UA
 * Edition ships it, or with one Feature Switch off.
 */
async function renderScreen({ switchedOff }: { switchedOff?: FeatureSwitch } = {}) {
  played = [];
  const composition = await testShell().composition.opened();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider
        shell={testShell({
          composition: opened(composition),
          remoteSwitches: switchedTo({
            ...edition,
            isFeatureEnabled: (feature) =>
              feature !== switchedOff && edition.isFeatureEnabled(feature),
          }),
        })}
      >
        <EditionProvider edition={edition} strings={editionStrings}>
          <InterfaceSoundsProvider sounds={{ play: (sound) => played.push(sound) }}>
            <BadgesScreen />
          </InterfaceSoundsProvider>
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  return composition;
}

/** Earns «Слово» (`win-words`) with a flawless Guess the Word Game. */
async function earnWinWords(composition: Awaited<ReturnType<typeof renderScreen>>) {
  await act(async () => {
    composition.xpLog
      .award({ source: 'game-finished', mode: 'guess-word', right: 10, played: 10 })
      .commit();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** The name of the UA Edition's Badge `id`. */
const nameOf = (id: string) => edition.badges.find((badge) => badge.id === id)?.name ?? id;

const strings = editionStrings.settings.badges;

describe('the Badges screen', () => {
  it("shows every UA Edition Badge in a grid by family, the unearned ones with their condition's progress", async () => {
    await renderScreen();

    expect(screen.getByText(strings.title)).toBeOnTheScreen();
    expect(screen.getByTestId('badges-count')).toHaveTextContent(
      `0 з ${String(edition.badges.length)}`,
    );
    const heads = screen.getAllByRole('header').slice(-edition.badgeFamilies.length);
    edition.badgeFamilies.forEach(({ name }, index) => {
      expect(heads[index]).toHaveTextContent(name);
    });
    for (const { id } of edition.badgeFamilies) {
      const members = edition.badges.filter(({ family }) => family === id).length;
      expect(screen.getByTestId(`badge-family-${id}-count`)).toHaveTextContent(
        `0 з ${String(members)}`,
      );
    }
    for (const { name } of edition.badges) expect(screen.getByLabelText(name)).toBeOnTheScreen();
    expect(screen.getByTestId('badge-streak-3')).toHaveAccessibilityValue({ text: '0 з 3 днів' });
    expect(screen.getByTestId('badge-confirmed-10')).toHaveAccessibilityValue({
      text: '0 з 10 записів',
    });
    expect(screen.getByTestId('badge-true-stress')).toHaveAccessibilityValue({
      text: '0 з 10 правильних відповідей',
    });
    expect(screen.getByTestId('badge-win-stress')).toHaveAccessibilityValue({
      text: 'Ще не отримано',
    });
    // Not only to VoiceOver: each mark shows how far its condition has come.
    expect(screen.getByTestId('badge-streak-3-status')).toHaveTextContent('0 з 3 днів');
    expect(screen.getByTestId('badge-streak-3-status')).toBeVisible();
    expect(screen.getByTestId('badge-win-stress-status')).toHaveTextContent('Ще не отримано');
  });

  it("writes each Badge's condition under its mark in the Edition's words", async () => {
    await renderScreen();

    for (const { id } of edition.badges)
      expect(screen.getByTestId(`badge-${id}-condition`)).toBeVisible();
    expect(screen.getByTestId('badge-streak-7-condition')).toHaveTextContent('7 днів поспіль');
    expect(screen.getByTestId('badge-confirmed-50-condition')).toHaveTextContent(
      '50 підтверджених записів',
    );
    expect(screen.getByTestId('badge-crossword-7-condition')).toHaveTextContent(
      '7 щоденних кросвордів поспіль',
    );
    expect(screen.getByTestId('badge-level-10-condition')).toHaveTextContent('Рівень 10');
    expect(screen.getByTestId('badge-rarity-5-condition')).toHaveTextContent(
      'Правильна відповідь на слово рідкості 5',
    );
    const title = (mode: string) => editionStrings.game.modes[mode]?.title ?? '';
    expect(screen.getByTestId('badge-win-corrections-condition')).toHaveTextContent(
      `Перша перемога: ${title('correction')}, ${title('anglicism')}`,
    );
    expect(screen.getByTestId('badge-clean-language-condition')).toHaveTextContent(
      `Гра без жодної помилки: ${title('correction')}, ${title('anglicism')}`,
    );
    expect(screen.getByTestId('badge-true-stress-condition')).toHaveTextContent(
      `10 правильних відповідей поспіль: ${title('stress')}`,
    );
  });

  it("says the day a Badge was earned in the Edition's words and, with the sheet off, stamps it at a tap", async () => {
    const composition = await renderScreen({ switchedOff: 'badgeSheet' });

    await act(async () => {
      composition.xpLog
        .award({ source: 'game-finished', mode: 'guess-word', right: 10, played: 10 })
        .commit();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByTestId('badge-win-words')).toHaveAccessibilityValue({
      text: 'Отримано 13 жовтня',
    });
    expect(screen.getByTestId('badge-win-words-status')).toHaveTextContent('Отримано 13 жовтня');
    expect(screen.getByTestId('badge-win-words-mark-symbol')).toHaveTextContent('Сл');
    expect(screen.queryByTestId('badge-win-stress-mark-symbol')).toBeNull();
    expect(screen.getByTestId('badges-count')).toHaveTextContent(
      `1 з ${String(edition.badges.length)}`,
    );

    await fireEvent.press(screen.getByTestId('badge-win-words'));
    expect(screen.getByText(editionStrings.settings.profile.badgeStamp.line)).toBeOnTheScreen();
  });

  it('with the sheet off, shows nothing at a tap on a Badge not yet earned', async () => {
    await renderScreen({ switchedOff: 'badgeSheet' });

    await fireEvent.press(screen.getByTestId('badge-streak-3'));
    expect(
      screen.queryByText(editionStrings.settings.profile.badgeStamp.line),
    ).not.toBeOnTheScreen();
    expect(screen.queryByTestId('badge-sheet')).not.toBeOnTheScreen();
    expect(screen.queryByText(fill(strings.lockedToast, { name: nameOf('streak-3') }))).toBeNull();
    expect(played).toEqual([]);
  });

  // Ticket #1646: board 10 p3/p4, the sheet at every tap on a Badge.
  it('opens the sheet at a tap on a Badge not yet earned, with its progress and the toast, and no shout', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('badge-streak-3'));

    const sheet = screen.getByTestId('badge-sheet');
    expect(within(sheet).getByText(strings.sheet.kicker)).toBeOnTheScreen();
    expect(within(sheet).getByRole('header')).toHaveTextContent(nameOf('streak-3'));
    expect(screen.getByTestId('badge-sheet-status')).toHaveTextContent('Ще ні · 0 з 3 днів');
    expect(
      screen.getByText(fill(strings.lockedToast, { name: nameOf('streak-3') })),
    ).toBeOnTheScreen();
    expect(played).toEqual([]);
    expect(screen.queryByText(editionStrings.settings.profile.badgeStamp.line)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: strings.sheet.done }));
    await waitFor(() => {
      expect(screen.queryByTestId('badge-sheet')).not.toBeOnTheScreen();
    });
  });

  it('opens the sheet with its date and the shout at a tap on an earned Badge, and no toast', async () => {
    const composition = await renderScreen();
    await earnWinWords(composition);

    await act(async () => {
      await fireEvent.press(screen.getByTestId('badge-win-words'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const sheet = screen.getByTestId('badge-sheet');
    expect(within(sheet).getByRole('header')).toHaveTextContent(nameOf('win-words'));
    expect(screen.getByTestId('badge-sheet-status')).toHaveTextContent('Отримано 13 жовтня');
    expect(screen.getByTestId('badge-sheet-mark-symbol')).toHaveTextContent('Сл');
    expect(played).toEqual(['shout']);
    expect(screen.queryByText(fill(strings.lockedToast, { name: nameOf('win-words') }))).toBeNull();
    expect(screen.queryByText(editionStrings.settings.profile.badgeStamp.line)).toBeNull();
  });

  it('drops the «НОВА» mark once the sheet opens the Badge', async () => {
    const composition = await renderScreen();
    await earnWinWords(composition);
    expect(screen.getByTestId('badge-win-words-mark-new')).toHaveTextContent(strings.newTag);

    await act(async () => {
      await fireEvent.press(screen.getByTestId('badge-win-words'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.queryByTestId('badge-win-words-mark-new')).toBeNull();
    expect(composition.xpLog.milestones.opened.has('win-words')).toBe(true);
  });

  // Ticket #1645: board 10.5/10.6, a new Badge carries «НОВА» until it is opened.
  it('marks a new Badge «НОВА», cream on its stamp, and drops the mark once the stamp opens it', async () => {
    const composition = await renderScreen({ switchedOff: 'badgeSheet' });
    await act(async () => {
      composition.xpLog
        .award({ source: 'game-finished', mode: 'guess-word', right: 10, played: 10 })
        .commit();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByTestId('badge-win-words-mark-new')).toHaveTextContent(strings.newTag);
    expect(screen.queryByTestId('badge-win-stress-mark-new')).toBeNull();

    await act(async () => {
      await fireEvent.press(screen.getByTestId('badge-win-words'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByTestId('badge-stamp-mark-new')).toHaveTextContent(strings.newTag);
    expect(screen.queryByTestId('badge-win-words-mark-new')).toBeNull();
    expect(composition.xpLog.milestones.opened.has('win-words')).toBe(true);

    await fireEvent.press(screen.getByTestId('badge-stamp-done'));
    await fireEvent.press(screen.getByTestId('badge-win-words'));
    expect(screen.queryByTestId('badge-stamp-mark-new')).toBeNull();
  });

  it('shows the symbol of a Badge in progress and none of one not started', async () => {
    const composition = await renderScreen();
    await act(async () => {
      composition.xpLog
        .award({ source: 'game-finished', mode: 'guess-word', right: 10, played: 10 })
        .commit();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByTestId('badge-streak-3')).toHaveAccessibilityValue({ text: '1 з 3 днів' });
    expect(screen.getByTestId('badge-streak-3-mark-symbol')).toBeOnTheScreen();
    expect(screen.queryByTestId('badge-streak-3-mark-new')).toBeNull();
    expect(screen.queryByTestId('badge-win-stress-mark-symbol')).toBeNull();
  });
});
