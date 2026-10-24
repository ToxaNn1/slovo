import { describe, expect, it, jest } from '@jest/globals';
import { router, Slot } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Linking, Text } from 'react-native';

import EntryLayout from './app/entry/_layout';
import EntryFromLinkScreen from './app/entry/[entryId]';
import { editionStrings } from './edition/edition';
import { createOutsideLinks } from './entries/entry-link';
import { NotificationTaps } from './notifications/notification-taps';

/**
 * The Entry screen's place: what the Entry route hands it, its «Назад» label
 * and where it opened from, which decides whether the Entry is Seen and goes
 * into History (`EntryScreen`).
 */
jest.mock('./entries/entry-screen', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { Text: StandIn } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    EntryScreen: ({ back, openedFrom }: { back: string; openedFrom?: string }) =>
      createElement(StandIn, { testID: 'entry-screen' }, `${back} | ${openedFrom ?? 'inside'}`),
  };
});

/** The key of the snapshot the widget reads now, which its links carry. */
const WIDGET_LINK_KEY = 'the-widgets-own';

/** Runs what a link or a tap starts, and lets the navigators finish it. */
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

/**
 * The app on the Feed, with the Entry stack and the notification taps at the
 * root, and the outside links of `+native-intent`. `open` hands it a link as
 * iOS hands over one another app or the widget opened, with the scheme.
 */
async function renderApp() {
  const listeners: ((event: { url: string }) => void)[] = [];
  jest.spyOn(Linking, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener);
    return { remove: () => undefined } as ReturnType<typeof Linking.addEventListener>;
  });
  const taps = fakeNotificationTaps();
  const app = renderRouter(
    {
      _layout: () => (
        <>
          <NotificationTaps onTap={taps.onTap} />
          <Slot />
        </>
      ),
      '+native-intent': {
        redirectSystemPath: createOutsideLinks(() => Promise.resolve(WIDGET_LINK_KEY)),
      },
      index: () => <Text>Feed</Text>,
      'entry/_layout': EntryLayout,
      'entry/[entryId]': EntryFromLinkScreen,
    },
    { initialUrl: '/' },
  );
  await app;
  await settle();
  return {
    pathname: () => app.getPathname(),
    taps,
    open: (url: string) =>
      settle(() => {
        for (const listener of listeners) listener({ url });
      }),
  };
}

/** What the Entry screen was handed: its «Назад» label and where it opened from. */
function entryScreen(): string {
  const { children } = screen.getByTestId('entry-screen').props as { children: string };
  return children;
}

const home = editionStrings.tabs.home;

describe('a link from outside the app', () => {
  it('opens the Entry without the «Назад» label it names', async () => {
    const app = await renderApp();
    await app.open('slovo-uk://entry/w_bevz?back=Ваш%20рахунок%20заблоковано');

    expect(app.pathname()).toBe('/entry/w_bevz');
    expect(entryScreen()).toBe(`${home} | inside`);
  });

  it.each([
    ['the widget’s mark without its key', 'slovo-uk://entry/w_bevz?from=widget'],
    ['the widget’s mark with another key', 'slovo-uk://entry/w_bevz?from=widget&key=guessed'],
    ['a notification’s mark', 'slovo-uk://entry/w_bevz?from=notification'],
  ])('with %s opens the Entry as a plain link, so it goes into no History', async (_, link) => {
    const app = await renderApp();
    await app.open(link);

    expect(app.pathname()).toBe('/entry/w_bevz');
    expect(entryScreen()).toBe(`${home} | inside`);
  });

  it('from the widget, with the key of its snapshot, opens the Entry as from the widget', async () => {
    const app = await renderApp();
    await app.open(`slovo-uk://entry/c_77szl9?from=widget&key=${WIDGET_LINK_KEY}`);

    expect(entryScreen()).toBe(`${home} | widget`);
  });
});

describe('links inside the app', () => {
  it('open a tapped notification’s Word as from a notification', async () => {
    const app = await renderApp();

    await app.taps.tap('/entry/w_khalamydnyk?from=notification');

    expect(app.pathname()).toBe('/entry/w_khalamydnyk');
    expect(entryScreen()).toBe(`${home} | notification`);
  });

  it('keep the «Назад» label they name', async () => {
    await renderApp();

    await settle(() => {
      router.push('/entry/c_0a1b2c?back=веремія');
    });

    expect(entryScreen()).toBe('веремія | inside');
  });
});
