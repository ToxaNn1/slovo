import { describe, expect, it, jest } from '@jest/globals';
import { type Edition, type FeatureSwitch } from '@slovo/core';
import { seedUserState, loadEdition } from '@slovo/core/testing';
import { act, fireEvent, screen, within } from '@testing-library/react-native';

import WidgetsScreen from '../app/settings/widgets';
import { activeEditionFiles, editionStrings } from '../edition/edition';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { renderApp } from '../shell/test-app';

jest.mock('expo-router', () => ({
  ...jest.requireActual<object>('expo-router'),
  useRouter: () => ({ back: () => undefined }),
}));

const { config } = activeEditionFiles;

/** A preview's segment as VoiceOver names it, e.g. «Віджети: Малий». */
const preview = (name: string) => `${editionStrings.settings.widgets.title}: ${name}`;
const strings = editionStrings.settings.widgets;

/** The drawing is a picture VoiceOver skips, so its queries look among hidden elements. */
const HIDDEN = { includeHiddenElements: true };

/** The UA Edition as it ships, with the Feature Switches named set as given. */
function editionWith(switches: Partial<Record<FeatureSwitch, boolean>>): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, string> };
  const states = Object.fromEntries(
    Object.entries(switches).map(([name, on]) => [name, on ? 'on' : 'off']),
  );
  return loadEdition({ ...rest, featureSwitches: { ...featureSwitches, ...states } });
}

/** Lets the composition's reads and the renders after them finish. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

/**
 * The Widgets screen over the Edition in effect with the switches named set
 * as given. Gives how many writes the user state has taken so far.
 */
async function renderWidgets(switches: Partial<Record<FeatureSwitch, boolean>> = {}) {
  const seeded = await seedUserState();
  let writes = 0;
  const userState: typeof seeded = {
    ...seeded,
    write: (changes) => {
      writes += 1;
      return seeded.write(changes);
    },
  };
  const opening = testShell({
    userState: opened(userState),
    remoteSwitches: switchedTo(editionWith(switches)),
  });
  // The screen is drawn under the gate of the composition's opening.
  const shell = { ...opening, composition: opened(await opening.composition.opened()) };
  await renderApp(<WidgetsScreen />, { shell });
  await settle();
  await settle();
  return { writes: () => writes };
}

describe('Settings › Віджети', () => {
  it('shows the board title and subtitle over three previews to flip through, none with a ✓', async () => {
    await renderWidgets();
    expect(screen.getByRole('header', { name: strings.title })).toBeOnTheScreen();
    expect(screen.getByText(strings.subtitle)).toBeOnTheScreen();
    for (const name of Object.values(strings.previews)) {
      expect(screen.getByRole('button', { name: preview(name) })).toBeOnTheScreen();
    }
    await fireEvent.press(
      screen.getByRole('button', { name: preview(strings.previews.lockScreen) }),
    );
    expect(screen.getByTestId('widget-previews-widget-lockScreen', HIDDEN)).toBeOnTheScreen();
    expect(screen.queryByText('✓')).toBeNull();
    // The three steps to add a widget stay under the previews.
    for (const [index, step] of editionStrings.widget.guide.steps.entries()) {
      expect(screen.getByTestId(`widget-guide-step-${String(index + 1)}`)).toHaveTextContent(
        `${String(index + 1)}${step.title}${step.hint}`,
      );
    }
  });

  it('offers no lock-screen preview while the lock-screen widget is off', async () => {
    await renderWidgets({ lockScreenWidget: false });
    expect(
      screen.getByRole('button', { name: preview(strings.previews.medium) }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: preview(strings.previews.lockScreen) })).toBeNull();
  });

  it('shows the steps alone while the widget previews are off', async () => {
    await renderWidgets({ widgetPreviews: false });
    expect(screen.queryByRole('button', { name: preview(strings.previews.small) })).toBeNull();
    expect(screen.queryByTestId('widget-previews-widget-medium', HIDDEN)).toBeNull();
    expect(screen.getByTestId('widget-guide-step-3')).toBeOnTheScreen();
  });

  it('keeps nothing when a preview is chosen', async () => {
    const { writes } = await renderWidgets();
    const before = writes();
    await fireEvent.press(screen.getByRole('button', { name: preview(strings.previews.small) }));
    await fireEvent.press(
      screen.getByRole('button', { name: preview(strings.previews.lockScreen) }),
    );
    await settle();
    expect(screen.getByTestId('widget-previews-widget-lockScreen', HIDDEN)).toBeOnTheScreen();
    expect(writes()).toBe(before);
  });
});

describe('Widgets › its header (app pass 91)', () => {
  it('keeps the back header above the list, so it stays put under the status bar while the list scrolls', async () => {
    await renderWidgets();

    expect(screen.getByRole('header', { name: strings.title })).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('widgets-scroll')).queryByRole('header', { name: strings.title }),
    ).toBeNull();
  });
});
