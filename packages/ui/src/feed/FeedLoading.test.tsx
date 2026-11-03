import type { ReactNode } from 'react';
import { EditionProvider, FeedLoading } from '@slovo/ui';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import { testStrings } from '../test-strings';

async function renderLoading(mascot?: ReactNode) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <FeedLoading text="Loading" accessibilityLabel="Loading the Feed" mascot={mascot} />
    </EditionProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
}

describe('FeedLoading', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the red wedges and its line of text as one busy progress bar', async () => {
    await renderLoading();

    expect(screen.getByTestId('feed-loading-wedges')).toBeTruthy();
    expect(screen.getByText('Loading')).toBeTruthy();
    const loading = screen.getByTestId('feed-loading');
    expect(loading.props['accessibilityRole']).toBe('progressbar');
    expect(loading.props['accessibilityLabel']).toBe('Loading the Feed');
    expect(loading.props['accessibilityState']).toEqual({ busy: true });
  });

  it('draws the Mascot over the wedges when the app shows it', async () => {
    await renderLoading(<Text>mascot</Text>);

    expect(screen.getByText('mascot')).toBeTruthy();
  });
});
