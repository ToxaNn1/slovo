import { describe, expect, it, jest } from '@jest/globals';
import type { Edition, FeatureSwitch, InterfaceSound, UserStateFact } from '@slovo/core';
import { seedUserState } from '@slovo/core/testing';
import { InterfaceSoundsProvider, ReduceMotionProvider } from '@slovo/ui';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { edition as shipped, editionStrings } from '../edition/edition';
import { SettingsProvider } from '../settings/settings';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { renderApp } from '../shell/test-app';
import { BadgesScreen } from './badges-screen';

/** The UA Edition as it ships, with the Daily Crossword on, so its Badges show (ADR 0176). */
const edition: Edition = {
  ...shipped,
  isFeatureEnabled: (feature) => feature === 'dailyCrossword' || shipped.isFeatureEnabled(feature),
};

jest.mock('expo-router', () => ({
  ...jest.requireActual<object>('expo-router'),
  useRouter: () => ({ back: jest.fn() }),
}));

/** The Interface sounds the screen played, in order. */
let played: InterfaceSound[] = [];

/**
 * The Badges screen over the Core's composition of a test Shell, as the UA
 * Edition ships it, or with one Feature Switch off, over the XP records kept
 * from before.
 */
async function renderScreen({
  switchedOff,
  xpLog,
  reduceMotion = false,
}: {
  switchedOff?: FeatureSwitch;
  xpLog?: UserStateFact<'xpLog'>;
  reduceMotion?: boolean;
} = {}) {
  played = [];
  const remoteSwitches = switchedTo({
    ...edition,
    isFeatureEnabled: (feature) => feature !== switchedOff && edition.isFeatureEnabled(feature),
  });
  const composition = await testShell({
    remoteSwitches,
    ...(xpLog === undefined ? {} : { userState: opened(await seedUserState({ xpLog })) }),
  }).composition.opened();
  await renderApp(
    <ReduceMotionProvider reduceMotion={reduceMotion}>
      <InterfaceSoundsProvider sounds={{ play: (sound) => played.push(sound) }}>
        <SettingsProvider>
          <BadgesScreen />
        </SettingsProvider>
      </InterfaceSoundsProvider>
    </ReduceMotionProvider>,
    {
      shell: testShell({
        composition: opened(composition),
        remoteSwitches,
      }),
    },
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

/** The XP records of the Daily Crossword solved on each of the six days before the test's today. */
const sixCrosswords: UserStateFact<'xpLog'> = Object.fromEntries(
  ['07', '08', '09', '10', '11', '12'].map((day) => {
    const date = `2026-10-${day}`;
    return [
      `seeded-crossword-${date}`,
      { kind: 'xp', date, at: `${date}T09:00:00.000Z`, source: 'daily-crossword', amount: 15 },
    ];
  }),
);

/** The name of the UA Edition's Badge `id`. */
const nameOf = (id: string) => edition.badges.find((badge) => badge.id === id)?.name ?? id;

const strings = editionStrings.settings.badges;

describe('the Badges screen', () => {
  it('heads the screen with the six Badge families, each with its count, description and shape', async () => {
    await renderScreen();

    const overview = screen.getByTestId('badge-families');
    const heads = within(overview).getAllByRole('header');
    expect(heads).toHaveLength(6);
    edition.badgeFamilies.forEach(({ id, name, description, shape }, index) => {
      expect(heads[index]).toHaveTextContent(name);
      const members = edition.badges.filter(({ family }) => family === id).length;
      expect(screen.getByTestId(`badge-families-${id}-count`)).toHaveTextContent(
        new RegExp(`^${String(members)} відзнак`),
      );
      expect(screen.getByTestId(`badge-families-${id}-description`)).toHaveTextContent(description);
      expect(screen.getByTestId(`badge-families-${id}-shape`)).toHaveTextContent(
        `${strings.families.shape}${strings.families.shapes[shape]}`,
      );
    });
    expect(screen.getByTestId('badge-families-streak-shape')).toHaveTextContent('ФОРМАШестикутник');
    expect(screen.getByTestId('badge-families-streak-count')).toHaveTextContent('5 відзнак');
    // The families come before the Badges' cards.
    const beforeCards = screen.getAllByRole('header').slice(0, -edition.badgeFamilies.length);
    expect(beforeCards).toEqual(expect.arrayContaining(heads));
  });

  it('leaves the families out with their Feature Switch off', async () => {
    await renderScreen({ switchedOff: 'badgeFamiliesOverview' });

    expect(screen.queryByTestId('badge-families')).not.toBeOnTheScreen();
    for (const { name } of edition.badges) expect(screen.getByLabelText(name)).toBeOnTheScreen();
  });

  it("shows a card for each of the 21 Badges by family with its name and status, the unearned ones by their condition's share", async () => {
    await renderScreen();

    expect(screen.getByText(strings.title)).toBeOnTheScreen();
    expect(edition.badges).toHaveLength(21);
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
    for (const { id, name } of edition.badges) {
      expect(screen.getByLabelText(name)).toBeOnTheScreen();
      expect(screen.getByTestId(`badge-${id}-name`)).toHaveTextContent(name);
    }
    expect(screen.getByTestId('badge-streak-3-status')).toHaveTextContent('Ще ні · 0%');
    expect(screen.getByTestId('badge-streak-3-status')).toBeVisible();
    expect(screen.getByTestId('badge-win-stress-status')).toHaveTextContent('Ще ні · 0%');
  });

  it('rounds a share down: six of the seven Daily Crosswords in a row read 85%', async () => {
    await renderScreen({ xpLog: sixCrosswords });

    expect(screen.getByTestId('badge-crossword-7-status')).toHaveTextContent('Ще ні · 85%');
    expect(screen.getByTestId('badge-crossword-7')).toHaveAccessibilityValue({
      text: 'Ще ні · 85%',
    });
  });

  it("writes each Badge's condition under its mark in the Edition's words", async () => {
    await renderScreen();

    for (const { id } of edition.badges)
      expect(screen.getByTestId(`badge-${id}-condition`)).toBeVisible();
    expect(screen.getByTestId('badge-streak-7-condition')).toHaveTextContent('7 днів поспіль');
    expect(screen.getByTestId('badge-confirmed-50-condition')).toHaveTextContent('50 слів «Знаю»');
    expect(screen.getByTestId('badge-win-corrections-condition')).toHaveTextContent(
      'Виграй гру з виправлень',
    );
    expect(screen.getByTestId('badge-level-10-condition')).toHaveTextContent('Досягни рівня 10');
    expect(screen.getByTestId('badge-true-stress-condition')).toHaveTextContent(
      '10 наголосів поспіль без помилок',
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

    expect(screen.getByTestId('badge-win-words')).toHaveAccessibilityValue({ text: 'Отримано' });
    expect(screen.getByTestId('badge-win-words-status')).toHaveTextContent('Отримано');
    expect(screen.getByTestId('badge-win-words-mark-symbol')).toHaveTextContent('Сл');
    expect(screen.getByTestId('badge-win-stress-status')).toHaveTextContent('Ще ні · 0%');
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
    expect(played).toEqual([]);
  });

  // Tickets #1646, #1917: XSaved p3/p4, the sheet under the «ВІДЗНАКА» plate.
  it('opens the sheet at a tap on a Badge not yet earned, with its progress, and no toast or shout', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('badge-streak-3'));

    const sheet = screen.getByTestId('badge-sheet');
    const [plate, name] = within(sheet).getAllByRole('header');
    expect(plate).toHaveTextContent(strings.sheet.kicker);
    expect(name).toHaveTextContent(nameOf('streak-3'));
    expect(screen.getByTestId('badge-sheet-condition')).toHaveTextContent('3 дні поспіль');
    expect(screen.getByTestId('badge-sheet-status')).toHaveTextContent('Ще ні · 0 з 3 днів');
    expect(screen.queryByText(/не твоя/)).not.toBeOnTheScreen();
    expect(played).toEqual([]);
    expect(screen.queryByText(editionStrings.settings.profile.badgeStamp.line)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: strings.sheet.done }));
    await waitFor(() => {
      expect(screen.queryByTestId('badge-sheet')).not.toBeOnTheScreen();
    });
  });

  // Ticket #1917: decision 5, the stamp only for an unopened Badge, the sheet for every other.
  it('stamps an unopened Badge with the shout, and its done button writes `badge-opened`', async () => {
    const composition = await renderScreen();
    await earnWinWords(composition);
    expect(screen.getByTestId('badge-win-words-mark-new')).toHaveTextContent(strings.newTag);

    await act(async () => {
      await fireEvent.press(screen.getByTestId('badge-win-words'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByText(editionStrings.settings.profile.badgeStamp.line)).toBeOnTheScreen();
    expect(screen.getByTestId('badge-stamp-mark-new')).toHaveTextContent(strings.newTag);
    expect(screen.queryByTestId('badge-sheet')).not.toBeOnTheScreen();
    expect(played).toEqual(['shout']);
    // Taken only at the button: until then the Badge stays new.
    expect(composition.xpLog.milestones.opened.has('win-words')).toBe(false);

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'ЗАБРАТИ' }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(composition.xpLog.milestones.opened.has('win-words')).toBe(true);
    expect(screen.queryByTestId('badge-win-words-mark-new')).toBeNull();
    expect(screen.queryByText(editionStrings.settings.profile.badgeStamp.line)).toBeNull();
  });

  // Ticket #1918: decision 13, the stamp of XBadges «Штамп»; Reduce Motion fades it in only.
  it.each([false, true])(
    'stamps the ribbon «ТЕПЕР ТВОЯ», shaking and flying only without Reduce Motion (%s)',
    async (reduceMotion) => {
      const composition = await renderScreen({ reduceMotion });
      await earnWinWords(composition);
      await act(async () => {
        await fireEvent.press(screen.getByTestId('badge-win-words'));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      const { ribbon } = editionStrings.settings.profile.badgeStamp;
      expect(screen.getByText(ribbon)).toBeOnTheScreen();
      const moving = ['badge-stamp-shake', 'badge-stamp-ribbon-flight', 'badge-stamp-ring'];
      for (const id of moving) {
        if (reduceMotion) expect(screen.queryByTestId(id)).toBeNull();
        else expect(screen.getByTestId(id)).toBeOnTheScreen();
      }
    },
  );

  it('opens the sheet with its date, and no stamp, toast or shout, at a tap on an opened Badge', async () => {
    const composition = await renderScreen();
    await earnWinWords(composition);
    await act(async () => {
      await fireEvent.press(screen.getByTestId('badge-win-words'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'ЗАБРАТИ' }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    played = [];

    await act(async () => {
      await fireEvent.press(screen.getByTestId('badge-win-words'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const sheet = screen.getByTestId('badge-sheet');
    const [plate, name] = within(sheet).getAllByRole('header');
    expect(plate).toHaveTextContent(strings.sheet.kicker);
    expect(name).toHaveTextContent(nameOf('win-words'));
    expect(screen.getByTestId('badge-sheet-condition')).toHaveTextContent('Виграй гру зі словами');
    expect(screen.getByTestId('badge-sheet-status')).toHaveTextContent('Отримано 13 жовтня');
    expect(screen.getByTestId('badge-sheet-mark-symbol')).toHaveTextContent('Сл');
    expect(played).toEqual([]);
    expect(screen.queryByText(/не твоя/)).toBeNull();
    expect(screen.queryByText(editionStrings.settings.profile.badgeStamp.line)).toBeNull();
  });

  it('opens the sheet, and no stamp, at a tap on a Badge in progress', async () => {
    const composition = await renderScreen();
    await earnWinWords(composition);

    await fireEvent.press(screen.getByTestId('badge-streak-3'));

    expect(screen.getByTestId('badge-sheet-status')).toHaveTextContent('Ще ні · 1 з 3 днів');
    expect(screen.queryByText(editionStrings.settings.profile.badgeStamp.line)).toBeNull();
  });

  // Ticket #1645: board 10.5/10.6, a new Badge carries «НОВА» until it is opened.
  it('marks a new Badge «НОВА», cream on its stamp, and drops the mark once the stamp is taken', async () => {
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

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'ЗАБРАТИ' }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByTestId('badge-win-words-mark-new')).toBeNull();
    expect(composition.xpLog.milestones.opened.has('win-words')).toBe(true);

    // With the sheet off, an opened Badge stamps again, no longer new.
    await fireEvent.press(screen.getByTestId('badge-win-words'));
    expect(screen.getByTestId('badge-stamp')).toBeOnTheScreen();
    expect(screen.queryByTestId('badge-stamp-mark-new')).toBeNull();
  });

  it('shows no symbol on a Badge in progress, nor on one not started', async () => {
    const composition = await renderScreen();
    await act(async () => {
      composition.xpLog
        .award({ source: 'game-finished', mode: 'guess-word', right: 10, played: 10 })
        .commit();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByTestId('badge-streak-3')).toHaveAccessibilityValue({ text: 'Ще ні · 33%' });
    expect(screen.getByTestId('badge-streak-3')).toHaveAccessibleName('Три дні поспіль');
    expect(screen.queryByTestId('badge-streak-3-mark-symbol')).toBeNull();
    expect(screen.queryByTestId('badge-streak-3-mark-new')).toBeNull();
    expect(screen.getByTestId('badge-win-stress-status')).toHaveTextContent('Ще ні · 0%');
  });

  it('draws no checker on a «Кросворд» Badge before it is earned, nor after one Daily Crossword', async () => {
    const composition = await renderScreen();
    expect(screen.queryByTestId('badge-crossword-7-mark-checker')).toBeNull();

    await act(async () => {
      composition.xpLog.award({ source: 'daily-crossword', date: '2026-10-13' }).commit();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByTestId('badge-crossword-7')).toHaveAccessibilityValue({
      text: 'Ще ні · 14%',
    });
    expect(screen.queryByTestId('badge-crossword-7-mark-checker')).toBeNull();
    expect(screen.queryByTestId('badge-crossword-7-mark-symbol')).toBeNull();
  });

  it('draws an earned «Кросворд» Badge as the checker under its name, and other families with their symbol', async () => {
    const composition = await renderScreen({ xpLog: sixCrosswords });
    expect(screen.queryByTestId('badge-crossword-7-mark-checker')).toBeNull();

    await act(async () => {
      composition.xpLog.award({ source: 'daily-crossword', date: '2026-10-13' }).commit();
      composition.xpLog
        .award({ source: 'game-finished', mode: 'guess-word', right: 10, played: 10 })
        .commit();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const crossword = screen.getByRole('button', { name: nameOf('crossword-7') });
    expect(within(crossword).getByTestId('badge-crossword-7-mark-checker')).toBeOnTheScreen();
    expect(within(crossword).queryByTestId('badge-crossword-7-mark-symbol')).toBeNull();
    const words = screen.getByRole('button', { name: nameOf('win-words') });
    expect(within(words).getByTestId('badge-win-words-mark-symbol')).toHaveTextContent('Сл');
    expect(within(words).queryByTestId('badge-win-words-mark-checker')).toBeNull();
  });
});
