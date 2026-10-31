import { describe, expect, it, jest } from '@jest/globals';
import { render, waitFor } from '@testing-library/react-native';

import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';
import { ScreenViews } from './screen-views';

let mockSegments: string[] = [];
jest.mock('expo-router', () => ({ useSegments: () => mockSegments }));

/** The test shell whose composition keeps each screen viewed it is told of. */
async function shellKeepingScreens() {
  const screens: string[] = [];
  const composition = await testShell().composition.opened();
  const shell = testShell({
    composition: opened({
      ...composition,
      analytics: {
        ...composition.analytics,
        screenViewed: (screen) => {
          screens.push(screen);
          return Promise.resolve();
        },
      },
    }),
  });
  return { shell, screens };
}

// Spec #1358 story 85; ADR 0068: a screen viewed is named by its route, never by an id in it.
describe('ScreenViews', () => {
  it('tells the composition each screen viewed by its route', async () => {
    const { shell, screens } = await shellKeepingScreens();
    mockSegments = ['(tabs)', 'settings'];
    const view = await render(
      <ShellProvider shell={shell}>
        <ScreenViews />
      </ShellProvider>,
    );
    await waitFor(() => {
      expect(screens).toEqual(['/(tabs)/settings']);
    });

    mockSegments = ['entry', '[id]'];
    await view.rerender(
      <ShellProvider shell={shell}>
        <ScreenViews />
      </ShellProvider>,
    );

    await waitFor(() => {
      expect(screens).toEqual(['/(tabs)/settings', '/entry/[id]']);
    });
  });
});
