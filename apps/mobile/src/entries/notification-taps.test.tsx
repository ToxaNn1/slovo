import { describe, expect, it, jest } from '@jest/globals';
import { router, Tabs, useLocalSearchParams, useRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Linking, Pressable, Text } from 'react-native';

import EntryLayout from '../app/entry/_layout';
import MoodLayout from '../app/mood/_layout';
import { createOutsideLinks } from './entry-link';
import { NotificationTaps } from './notification-taps';
import { useReplaceOpenEntry } from './replace-open-entry';
import { createLinkRelay } from './widget-entry-links';

/** The key of the snapshot the widget reads now, which its links carry. */
const WIDGET_LINK_KEY = 'the-widgets-own';

/**
 * Runs what a link or a tap starts, and lets the navigators finish it: the
 * test renderer runs on fake timers. React checks that an async act is
 * awaited on a timer, which these fake timers run early, so it logs once
 * that one was not.
 */
async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    jest.runAllTimers();
  });
}

/** Stands in for the device's notifications: the test taps a notification's link. */
function fakeNotificationTaps() {
  let open: ((link: string) => void) | undefined;
  return {
    onTap: (listener: (link: string) => void) => {
      open = listener;
      return () => {
        open = undefined;
      };
    },
    tap: (link: string) => settle(() => open?.(link)),
  };
}

/** Opens a link from inside the app, as a Word card's link to a Correction does, or from the widget. */
const push = (link: string) =>
  settle(() => {
    router.push(link);
  });

/** Taps «Назад» on the Entry screen of `entryId`. */
async function back(entryId: string) {
  await fireEvent.press(screen.getByTestId(`entry-back-${entryId}`));
  await settle();
}

/** The Entry route's place: its id and its «Назад», which goes back as the Entry screen's does. */
function EntryScreenStandIn() {
  const entryRouter = useRouter();
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Назад"
      testID={`entry-back-${entryId}`}
      onPress={() => {
        entryRouter.back();
      }}
    >
      <Text>{entryId}</Text>
    </Pressable>
  );
}

/** The Feed's place: a 🎲 that opens the Word the mood roulette lands on, as `MoodButtonAndSheet` does. */
function FeedStandIn() {
  const replaceOpenEntry = useReplaceOpenEntry();
  return (
    <Pressable
      accessibilityRole="button"
      testID="mood-roulette"
      onPress={() => {
        replaceOpenEntry(`/mood/w_${String((landings += 1))}`);
      }}
    >
      <Text>Feed</Text>
    </Pressable>
  );
}

/** How many Words the roulette has landed on, which names the next. */
let landings = 0;

/**
 * The app's tabs, its Entry stack and the mood roulette's stack, with the
 * notification taps at the root and the outside links of `+native-intent`
 * as in the app, opened on the Feed, with `replaceOpenEntry` on or off.
 * `openFromWidget` hands it the widget's link to an Entry as iOS hands it
 * over while the app runs.
 */
async function renderApp(
  taps: ReturnType<typeof fakeNotificationTaps>,
  { replaceOpenEntry = true }: { replaceOpenEntry?: boolean } = {},
) {
  landings = 0;
  const listeners: ((event: { url: string }) => void)[] = [];
  jest.spyOn(Linking, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener);
    return { remove: () => undefined } as ReturnType<typeof Linking.addEventListener>;
  });
  const widgetLinks = createLinkRelay();
  const app = renderRouter(
    {
      _layout: () => (
        <>
          <NotificationTaps onTap={taps.onTap} onWidgetLink={widgetLinks.listen} />
          <Tabs screenOptions={{ headerShown: false }}>
            <Tabs.Screen name="index" />
            <Tabs.Screen name="entry" options={{ href: null }} />
            <Tabs.Screen name="mood" options={{ href: null }} />
          </Tabs>
        </>
      ),
      '+native-intent': {
        redirectSystemPath: createOutsideLinks({
          domain: 'slovo.example',
          editionId: 'uk',
          widgetLinkKey: () => Promise.resolve(WIDGET_LINK_KEY),
          appIntents: { on: () => Promise.resolve(true), landOnWordOfTheDay: () => undefined },
          widgetEntries: {
            replaceOpenEntry: () => Promise.resolve(replaceOpenEntry),
            open: widgetLinks.open,
          },
        }),
      },
      index: FeedStandIn,
      'entry/_layout': EntryLayout,
      'entry/[entryId]': EntryScreenStandIn,
      'mood/_layout': MoodLayout,
      'mood/[entryId]': EntryScreenStandIn,
    },
    { initialUrl: '/' },
  );
  await app;
  await settle();
  /** The ids of the Entries on a stack of links, bottom first. */
  const stack = (name: string) => {
    const tabs = app.getRouterState()?.routes[0]?.state;
    const tab = tabs?.routes.find((route) => route.name === name);
    return (tab?.state?.routes ?? []).map((route) => (route.params as { entryId: string }).entryId);
  };
  return {
    pathname: () => app.getPathname(),
    entryStack: () => stack('entry'),
    moodStack: () => stack('mood'),
    openFromWidget: (entryId: string) =>
      settle(() => {
        for (const listener of listeners) {
          listener({ url: `slovo-uk://entry/${entryId}?from=widget&key=${WIDGET_LINK_KEY}` });
        }
      }),
    spinRoulette: async () => {
      await fireEvent.press(screen.getByTestId('mood-roulette'));
      await settle();
    },
  };
}

describe('a tapped notification opens its Entry', () => {
  it('replaces the Entry of another notification, so «Назад» returns to the Feed', async () => {
    const taps = fakeNotificationTaps();
    const app = await renderApp(taps);

    await taps.tap('/entry/w_bevz?from=notification');
    await taps.tap('/entry/w_khalamydnyk?from=notification');

    expect(app.pathname()).toBe('/entry/w_khalamydnyk');
    expect(app.entryStack()).toEqual(['w_khalamydnyk']);
    await back('w_khalamydnyk');
    expect(app.pathname()).toBe('/');
  });

  it("replaces the Entry the widget's link opened", async () => {
    const taps = fakeNotificationTaps();
    const app = await renderApp(taps);

    await push('/entry/w_bevz?from=widget');
    await taps.tap('/entry/w_khalamydnyk?from=notification');

    expect(app.entryStack()).toEqual(['w_khalamydnyk']);
  });

  it('opens on top of the Feed, and «Назад» returns to it', async () => {
    const taps = fakeNotificationTaps();
    const app = await renderApp(taps);

    await taps.tap('/entry/w_bevz?from=notification');

    expect(app.pathname()).toBe('/entry/w_bevz');
    await back('w_bevz');
    expect(app.pathname()).toBe('/');
  });

  it('replaces the Entry the Feed opened, so «Назад» returns to the Feed', async () => {
    const taps = fakeNotificationTaps();
    const app = await renderApp(taps);

    await push('/entry/w_bevz');
    await taps.tap('/entry/w_khalamydnyk?from=notification');

    expect(app.entryStack()).toEqual(['w_khalamydnyk']);
    await back('w_khalamydnyk');
    expect(app.pathname()).toBe('/');
  });

  it('replaces the whole Entry stack, a Correction over an Entry too, so «Назад» returns to the Feed', async () => {
    const taps = fakeNotificationTaps();
    const app = await renderApp(taps);

    await taps.tap('/entry/w_bevz?from=notification');
    await push('/entry/c_0a1b2c');
    await taps.tap('/entry/w_khalamydnyk?from=notification');

    expect(app.pathname()).toBe('/entry/w_khalamydnyk');
    expect(app.entryStack()).toEqual(['w_khalamydnyk']);
    await back('w_khalamydnyk');
    expect(app.pathname()).toBe('/');
  });
});

describe('a tapped notification after «Назад» from an Entry', () => {
  it('opens its Entry alone, so «Назад» returns to the Feed, not to the Entry left', async () => {
    const taps = fakeNotificationTaps();
    const app = await renderApp(taps);

    await taps.tap('/entry/w_bevz?from=notification');
    await back('w_bevz');
    await taps.tap('/entry/w_khalamydnyk?from=notification');

    expect(app.entryStack()).toEqual(['w_khalamydnyk']);
    await back('w_khalamydnyk');
    expect(app.pathname()).toBe('/');
  });
});

describe("the widget's link while the app runs", () => {
  it('replaces the open Entry, so «Назад» returns to the Feed', async () => {
    const app = await renderApp(fakeNotificationTaps());

    await app.openFromWidget('w_bevz');
    await app.openFromWidget('w_khalamydnyk');

    expect(app.pathname()).toBe('/entry/w_khalamydnyk');
    expect(app.entryStack()).toEqual(['w_khalamydnyk']);
    await back('w_khalamydnyk');
    expect(app.pathname()).toBe('/');
  });

  it('replaces the Entry the Feed opened and a Correction over it', async () => {
    const app = await renderApp(fakeNotificationTaps());

    await push('/entry/w_bevz');
    await push('/entry/c_0a1b2c');
    await app.openFromWidget('w_khalamydnyk');

    expect(app.entryStack()).toEqual(['w_khalamydnyk']);
    await back('w_khalamydnyk');
    expect(app.pathname()).toBe('/');
  });

  it('replaces the Entry the reader left with «Назад»', async () => {
    const app = await renderApp(fakeNotificationTaps());

    await push('/entry/w_bevz');
    await back('w_bevz');
    await app.openFromWidget('w_khalamydnyk');

    expect(app.entryStack()).toEqual(['w_khalamydnyk']);
    await back('w_khalamydnyk');
    expect(app.pathname()).toBe('/');
  });

  it('opens over the open Entry, as Expo Router does, while replaceOpenEntry is off', async () => {
    const app = await renderApp(fakeNotificationTaps(), { replaceOpenEntry: false });

    await push('/entry/w_bevz');
    await push('/entry/c_0a1b2c');
    await app.openFromWidget('w_khalamydnyk');

    expect(app.entryStack()).toEqual(['w_bevz', 'w_khalamydnyk']);
    await back('w_khalamydnyk');
    expect(app.pathname()).toBe('/entry/w_bevz');
  });
});

describe('a second Word from the mood roulette', () => {
  it('replaces the first, so «Назад» returns to «Головна»', async () => {
    const app = await renderApp(fakeNotificationTaps());

    await app.spinRoulette();
    expect(app.pathname()).toBe('/mood/w_1');
    await back('w_1');
    await app.spinRoulette();

    expect(app.pathname()).toBe('/mood/w_2');
    expect(app.moodStack()).toEqual(['w_2']);
    await back('w_2');
    expect(app.pathname()).toBe('/');
  });
});
