import { EditionProvider, FeedHeader, StatsPill } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { testStrings } from '../test-strings';

const strings = testStrings({
  stats: {
    pillLabel: { one: 'Stats: {count} day', other: 'Stats: {count} days' },
    pillLabelWithoutStreak: 'Stats',
  },
  dashboard: { open: 'SLOVO, home' },
});

async function renderHeader({
  hideStreak = false,
  onOpenDashboard,
}: { hideStreak?: boolean; onOpenDashboard?: () => void } = {}) {
  const onPress = jest.fn();
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <FeedHeader
        wordmark="SLOVO"
        today="Mon, 2 November"
        streak={<StatsPill streak={12} hideStreak={hideStreak} onPress={onPress} />}
        onOpenDashboard={onOpenDashboard}
      />
    </EditionProvider>,
  );
  return onPress;
}

describe('FeedHeader', () => {
  it('heads the Feed with the wordmark, today and the Streak pill', async () => {
    await renderHeader();
    expect(screen.getByRole('header', { name: 'SLOVO' })).toBeTruthy();
    expect(screen.getByText('Mon, 2 November')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stats: 12 days' })).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('opens the stats from the Streak pill', async () => {
    const onPress = await renderHeader();
    await fireEvent.press(screen.getByRole('button', { name: 'Stats: 12 days' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps the pill without the number while the reader hides the Streak', async () => {
    await renderHeader({ hideStreak: true });
    expect(screen.getByRole('button', { name: 'Stats' })).toBeTruthy();
    expect(screen.queryByText('12')).toBeNull();
  });

  it('opens the Dashboard from the wordmark when it is given a way there', async () => {
    const onOpenDashboard = jest.fn();
    await renderHeader({ onOpenDashboard });
    expect(screen.queryByRole('header', { name: 'SLOVO' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'SLOVO, home' }));
    expect(onOpenDashboard).toHaveBeenCalledTimes(1);
  });

  it('keeps the wordmark a plain header without a way to the Dashboard', async () => {
    await renderHeader();
    expect(screen.queryByRole('button', { name: 'SLOVO, home' })).toBeNull();
  });
});
