import { EditionProvider, FeedLoading } from '@slovo/ui';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { testStrings } from '../test-strings';

async function renderLoading() {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <FeedLoading accessibilityLabel="Loading the Feed" />
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

  it('draws the card placeholder with the red wedges and three bars under it as one busy progress bar', async () => {
    await renderLoading();

    expect(screen.getByTestId('feed-loading-card')).toBeTruthy();
    expect(screen.getByTestId('feed-loading-wedges')).toBeTruthy();
    expect(screen.getAllByTestId('feed-loading-bar')).toHaveLength(3);
    const loading = screen.getByTestId('feed-loading');
    expect(loading.props['accessibilityRole']).toBe('progressbar');
    expect(loading.props['accessibilityLabel']).toBe('Loading the Feed');
    expect(loading.props['accessibilityState']).toEqual({ busy: true });
  });

  it('writes no text', async () => {
    await renderLoading();

    expect(screen.queryAllByText(/./)).toHaveLength(0);
  });
});
