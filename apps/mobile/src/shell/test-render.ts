import { jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import type * as ExpoLinkingModule from 'expo-linking';
import { renderRouter } from 'expo-router/testing-library';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// The renderers of the app's screen and route tests. No screen or module of the app imports them.
// Each draws inside the gesture root the app's `_layout.tsx` puts at its own root: Gesture
// Handler 3's `GestureDetector` throws without one, in Jest too.

/** Renders a screen or component with React Native Testing Library. */
export function renderInGestureRoot(...[ui, options]: Parameters<typeof render>) {
  return render(ui, { wrapper: GestureHandlerRootView, ...options });
}

/** Renders a route map with Expo Router's test renderer. */
export function renderRoutes(...[context, options]: Parameters<typeof renderRouter>) {
  return renderRouter(context, { wrapper: GestureHandlerRootView, ...options });
}

/** The `url` listeners of the rendered routes, each removed when its app unmounts. */
const linkListeners = new Set<ExpoLinkingModule.URLListener>();

// Expo Router follows `url` events through `expo-linking`, which its test renderer mocks. The
// router copies the module's functions the first time it subscribes and keeps that copy for the
// whole test file, so a spy set up per test reaches only the first test. This listener stays
// put, set once before any route renders.
jest.requireMock<typeof ExpoLinkingModule>('expo-linking').addEventListener = (_type, listener) => {
  linkListeners.add(listener);
  return { remove: () => linkListeners.delete(listener) };
};

/** Hands the rendered routes a `url` event, as the system does when a link opens the running app. */
export function sendLink(url: string): void {
  for (const listener of linkListeners) listener({ url });
}
