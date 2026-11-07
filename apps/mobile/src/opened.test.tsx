import { describe, expect, it } from '@jest/globals';
import { EditionProvider } from '@slovo/ui';
import { screen } from '@testing-library/react-native';
import { renderInGestureRoot } from './shell/test-render';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { edition, editionStrings } from './edition/edition';
import { Opened } from './opened';
import type { Opening, OpeningState } from './opening';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** An opening that stays in `state`. */
function standing(state: OpeningState<unknown>): Opening<unknown> {
  return {
    state,
    opened: () => new Promise(() => undefined),
    reopen: () => Promise.resolve(),
    subscribe: () => () => undefined,
  };
}

async function renderGate(state: OpeningState<unknown>) {
  await renderInGestureRoot(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={edition} strings={editionStrings}>
        <Opened opening={standing(state)} failedTestID="gate-failed">
          <Text testID="opened">open</Text>
        </Opened>
      </EditionProvider>
    </SafeAreaProvider>,
  );
}

describe('the gate of an opening', () => {
  it('shows the Mascot waiting over the loading state', async () => {
    await renderGate({ status: 'loading' });

    expect(screen.getByTestId('feed-loading')).toBeOnTheScreen();
    expect(screen.getByTestId('mascot-waits')).toBeOnTheScreen();
    expect(screen.queryByTestId('opened')).toBeNull();
  });

  it('shows the Mascot cringing in the error state', async () => {
    await renderGate({ status: 'failed', retry: () => undefined });

    expect(screen.getByTestId('gate-failed')).toBeOnTheScreen();
    expect(screen.getByTestId('mascot-cringes')).toBeOnTheScreen();
    expect(screen.queryByTestId('opened')).toBeNull();
  });

  it('shows no Mascot once it is open', async () => {
    await renderGate({ status: 'ready', value: null });

    expect(screen.getByTestId('opened')).toBeOnTheScreen();
    expect(screen.queryByTestId(/^mascot-/)).toBeNull();
  });
});
