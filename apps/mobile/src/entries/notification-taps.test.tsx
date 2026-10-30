import { describe, expect, it, jest } from '@jest/globals';
import { router, Tabs, useLocalSearchParams, useRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Pressable, Text } from 'react-native';

import EntryLayout from '../app/entry/_layout';
import { NotificationTaps } from './notification-taps';

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

/**
 * The app's tabs and its Entry stack, with the notification taps at the root
 * as in the app, opened on the Feed.
 */
async function renderApp(taps: ReturnType<typeof fakeNotificationTaps>) {
  const app = renderRouter(
    {
      _layout: () => (
        <>
          <NotificationTaps onTap={taps.onTap} />
          <Tabs screenOptions={{ headerShown: false }}>
            <Tabs.Screen name="index" />
            <Tabs.Screen name="entry" options={{ href: null }} />
          </Tabs>
        </>
      ),
      index: () => <Text>Feed</Text>,
      'entry/_layout': EntryLayout,
      'entry/[entryId]': EntryScreenStandIn,
    },
    { initialUrl: '/' },
  );
  await app;
  await settle();
  return {
    pathname: () => app.getPathname(),
    /** The ids of the Entries on the Entry stack, bottom first. */
    entryStack: () => {
      const tabs = app.getRouterState()?.routes[0]?.state;
      const entryTab = tabs?.routes.find((route) => route.name === 'entry');
      return (entryTab?.state?.routes ?? []).map(
        (route) => (route.params as { entryId: string }).entryId,
      );
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
