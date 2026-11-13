import { describe, expect, it } from '@jest/globals';
import type { Composition } from '@slovo/core';
import { act, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { useCompositionRead } from './composition';
import { ShellProvider } from './shell-value';
import { renderInGestureRoot } from './shell/test-render';
import { testShell } from './shell/test-support';

/** The compositions read, in turn, each with a resolve of its read. */
const reads: { in: Composition; resolve: (text: string) => void }[] = [];

function read(composition: Composition): Promise<string> {
  return new Promise((resolve) => reads.push({ in: composition, resolve }));
}

function Reading() {
  const state = useCompositionRead(read, 'Could not read');
  return <Text>{state.status === 'ready' ? state.value : state.status}</Text>;
}

describe('useCompositionRead', () => {
  it('shows nothing read from a composition reopened over it until the new one is read', async () => {
    const shell = testShell();
    await shell.composition.opened();
    await renderInGestureRoot(
      <ShellProvider shell={shell}>
        <Reading />
      </ShellProvider>,
    );
    await act(async () => reads[0]?.resolve('first'));
    expect(screen.getByText('first')).toBeTruthy();

    await act(() => shell.composition.reopen());
    expect(reads).toHaveLength(2);
    expect(reads[1]?.in).not.toBe(reads[0]?.in);
    expect(screen.queryByText('first')).toBeNull();
    expect(screen.getByText('loading')).toBeTruthy();

    await act(async () => reads[1]?.resolve('second'));
    expect(screen.getByText('second')).toBeTruthy();
  });
});
