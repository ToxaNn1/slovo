import { describe, expect, it, jest } from '@jest/globals';
import { router, Slot } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Linking, Text } from 'react-native';

import EntryLayout from '../app/entry/_layout';
import EntryFromLinkScreen from '../app/entry/[entryId]';
import GameEntryScreen from '../app/game/[entryId]';
import FavoriteEntryScreen from '../app/saved/favorites/[entryId]';
import HistoryEntryScreen from '../app/saved/history/[entryId]';
import LearningEntryScreen from '../app/saved/learning/[entryId]';
import { editionStrings } from '../edition/edition';
import { APP_INTENT_ROUTES } from './app-intents';
import { createOutsideLinks } from './entry-link';
import { NotificationTaps } from './notification-taps';
import { createLinkRelay } from './widget-entry-links';

/**
 * The Entry screen's place: what the Entry route hands it, its «Назад» label
 * and where it opened from, which decides whether the Entry is Seen and goes
 * into History (`EntryScreen`).
 */
jest.mock('./entry-screen', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { Text: StandIn } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    EntryScreen: ({ back, openedFrom }: { back: string; openedFrom?: string }) =>
      createElement(StandIn, { testID: 'entry-screen' }, `${back} | ${openedFrom ?? 'inside'}`),
  };
});

/** The Edition's link domain, the only one whose web addresses iOS hands the app. */
const LINK_DOMAIN = 'slovo.example';

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
 * The app on the Feed, or the given route, with the Entry stack and the
 * notification taps at the root, and the outside links of `+native-intent`,
 * with the App Intents on or off. `open` hands it a link as iOS hands over
 * one another app, the widget or an App Intent opened, with the scheme;
 * `landings` counts the asks to land on the Word of the Day card.
 */
async function renderApp({
  initialUrl = '/',
  appIntents = true,
}: { initialUrl?: string; appIntents?: boolean } = {}) {
  let landings = 0;
  const listeners: ((event: { url: string }) => void)[] = [];
  jest.spyOn(Linking, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener);
    return { remove: () => undefined } as ReturnType<typeof Linking.addEventListener>;
  });
  const taps = fakeNotificationTaps();
  const widgetLinks = createLinkRelay();
  const app = renderRouter(
    {
      _layout: () => (
        <>
          <NotificationTaps onTap={taps.onTap} onWidgetLink={widgetLinks.listen} />
          <Slot />
        </>
      ),
      '+native-intent': {
        redirectSystemPath: createOutsideLinks({
          linkDomain: LINK_DOMAIN,
          widgetLinkKey: () => Promise.resolve(WIDGET_LINK_KEY),
          appIntents: {
            on: () => Promise.resolve(appIntents),
            landOnWordOfTheDay: () => {
              landings += 1;
            },
          },
          // The app is launched by none of these links; a widget link goes to the notification taps.
          widgetEntries: { replaceOpenEntry: () => Promise.resolve(true), open: widgetLinks.open },
        }),
      },
      index: () => <Text>Feed</Text>,
      'game/index': () => <Text>Game</Text>,
      // Expo Router's own screen for a path with no route, which needs the app's manifest.
      '+not-found': () => <Text>No such route</Text>,
      'entry/_layout': EntryLayout,
      'entry/[entryId]': EntryFromLinkScreen,
      'saved/favorites/[entryId]': FavoriteEntryScreen,
      'saved/history/[entryId]': HistoryEntryScreen,
      'saved/learning/[entryId]': LearningEntryScreen,
      'game/[entryId]': GameEntryScreen,
      // The recipient sheet needs the composition; its own test draws it.
      'c/[linkId]': () => <Text>Recipient sheet</Text>,
    },
    { initialUrl },
  );
  await app;
  await settle();
  return {
    pathname: () => app.getPathname(),
    landings: () => landings,
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

  it.each([
    ['a trailing slash', 'slovo-uk://entry/w_bevz/?back=Вхід&from=widget'],
    ['a doubled slash', 'slovo-uk://entry//w_bevz?back=Вхід&from=widget'],
    ['slashes doubled and trailing', 'slovo-uk://entry//w_bevz//?back=Вхід&from=notification'],
  ])('with %s opens the Entry without the label, so it goes into no History', async (_, link) => {
    const app = await renderApp();
    await app.open(link);

    expect(app.pathname()).toBe('/entry/w_bevz');
    expect(entryScreen()).toBe(`${home} | inside`);
  });

  it.each([
    ['Favorites', 'saved/favorites', editionStrings.favorites.title],
    ['History', 'saved/history', editionStrings.history.title],
    ['Learning', 'saved/learning', editionStrings.learning.title],
    ['the Game', 'game', editionStrings.game.title],
  ])('to an Entry of %s opens it without the label it names', async (_, route, title) => {
    const app = await renderApp();
    await app.open(`slovo-uk://${route}/w_bevz/?back=Вхід&from=widget`);

    expect(app.pathname()).toBe(`/${route}/w_bevz`);
    expect(entryScreen()).toBe(`${title} | inside`);
  });

  it('from the widget, with the key of its snapshot, opens the Entry as from the widget', async () => {
    const app = await renderApp();
    await app.open(`slovo-uk://entry/c_77szl9?from=widget&key=${WIDGET_LINK_KEY}`);

    expect(entryScreen()).toBe(`${home} | widget`);
  });
});

describe('a Collection Link from outside the app', () => {
  it.each([
    ['its web address', `https://${LINK_DOMAIN}/c/aB3dE5gH7k`],
    ["the Edition's scheme", 'slovo-uk://c/aB3dE5gH7k'],
    [
      'its web address in other letter case, a slash and params',
      `HTTPS://Slovo.Example/c/aB3dE5gH7k/?x=1#top`,
    ],
    [
      "the dev client's link",
      `slovo-uk://expo-development-client/?url=${encodeURIComponent(`https://${LINK_DOMAIN}/c/aB3dE5gH7k`)}`,
    ],
  ])('as %s opens the recipient sheet of its id', async (_, link) => {
    const app = await renderApp();
    await app.open(link);

    expect(app.pathname()).toBe('/c/aB3dE5gH7k');
  });

  it.each([
    ['an id too short', 'slovo-uk://c/aB3dE5gH7'],
    ['an id too long', `https://${LINK_DOMAIN}/c/aB3dE5gH7kX`],
    ['a sign the backend never puts in an id', 'slovo-uk://c/aB3dE5gH7-'],
    ['no id', `https://${LINK_DOMAIN}/c/`],
    ['a path after the id', 'slovo-uk://c/aB3dE5gH7k/more'],
    ['the web address of another host', 'https://other.example/c/aB3dE5gH7k'],
    ['the web address of a host ending in its domain', `https://not${LINK_DOMAIN}/c/aB3dE5gH7k`],
    ['the web address of a host under its domain', `https://www.${LINK_DOMAIN}/c/aB3dE5gH7k`],
    [
      "the dev client's link to another host",
      `slovo-uk://expo-development-client/?url=${encodeURIComponent('https://other.example/c/aB3dE5gH7k')}`,
    ],
  ])('with %s is ignored: the app stays where it is', async (_, link) => {
    const app = await renderApp();
    await app.open(link);

    expect(app.pathname()).toBe('/');
    expect(screen.getByText('Feed')).toBeTruthy();
  });
});

describe('an App Intent', () => {
  const wordOfTheDay = `slovo-uk://${APP_INTENT_ROUTES.wordOfTheDay}`;
  const openGame = `slovo-uk://${APP_INTENT_ROUTES.openGame}`;

  it('«Слово дня» opens the Feed and lands on the Word of the Day card', async () => {
    const app = await renderApp({ initialUrl: '/saved/history/w_bevz' });
    await app.open(wordOfTheDay);

    expect(app.pathname()).toBe('/');
    expect(screen.getByText('Feed')).toBeTruthy();
    expect(app.landings()).toBe(1);
  });

  it('«Слово дня» lands again when the reader is on the Feed', async () => {
    const app = await renderApp();
    await app.open(wordOfTheDay);
    await app.open(wordOfTheDay);

    expect(app.pathname()).toBe('/');
    expect(app.landings()).toBe(2);
  });

  it('«Відкрити гру» opens the Game', async () => {
    const app = await renderApp();
    await app.open(openGame);

    expect(app.pathname()).toBe('/game');
    expect(screen.getByText('Game')).toBeTruthy();
    expect(app.landings()).toBe(0);
  });

  it.each([
    ['«Слово дня»', wordOfTheDay],
    ['«Відкрити гру»', openGame],
  ])('%s with the App Intents off opens the app’s start and lands nowhere', async (_, link) => {
    const app = await renderApp({ initialUrl: '/saved/history/w_bevz', appIntents: false });
    await app.open(link);

    expect(app.pathname()).toBe('/');
    expect(screen.getByText('Feed')).toBeTruthy();
    expect(app.landings()).toBe(0);
  });

  it('a link to the Game without the intent’s mark opens it, the App Intents off or not', async () => {
    const app = await renderApp({ appIntents: false });
    await app.open('slovo-uk://game');

    expect(app.pathname()).toBe('/game');
  });
});

describe('a link from outside the app to no Entry', () => {
  it("opens, as the dev client's link, the route of the link in it", async () => {
    const app = await renderApp();

    await app.open(
      `slovo-uk://expo-development-client/?url=${encodeURIComponent('http://192.168.1.20:8082')}`,
    );

    expect(app.pathname()).toBe('/');
    expect(screen.getByText('Feed')).toBeTruthy();
  });

  it("opens, as the dev client's link to an Entry, the Entry without the label it names", async () => {
    const app = await renderApp();

    await app.open(
      `slovo-uk://expo-development-client/?url=${encodeURIComponent('slovo-uk://entry/w_bevz?back=Вхід&from=notification')}`,
    );

    expect(app.pathname()).toBe('/entry/w_bevz');
    expect(entryScreen()).toBe(`${home} | inside`);
  });

  it('goes on to the router as it came, to a path the app has no route for', async () => {
    const app = await renderApp();

    await app.open('slovo-uk://nowhere/at-all?from=widget');

    expect(app.pathname()).toBe('/nowhere/at-all');
    expect(screen.getByText('No such route')).toBeTruthy();
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
