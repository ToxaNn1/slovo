import { CollectionShareSheet, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const copy = {
  title: 'Share a link',
  snapshot: 'As it was when shared.',
  copy: 'Copy the link',
  share: 'Share',
  cancel: 'Cancel',
};

const URL = 'https://slovoapp.org/uk/c/abc123defg';

async function renderSheet({
  canCopy = true,
  url = URL,
}: { canCopy?: boolean; url?: string } = {}) {
  const onCopy = jest.fn();
  const onShare = jest.fn();
  const onClose = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <CollectionShareSheet
          url={url}
          copy={copy}
          onCopy={canCopy ? onCopy : undefined}
          onShare={onShare}
          onClose={onClose}
        />
      </EditionProvider>
    </SafeAreaProvider>,
  );
  return { onCopy, onShare, onClose };
}

describe('CollectionShareSheet', () => {
  it('shows the Collection Link without its scheme under the snapshot line', async () => {
    await renderSheet();

    expect(screen.getByText('Share a link')).toBeOnTheScreen();
    expect(screen.getByText('As it was when shared.')).toBeOnTheScreen();
    expect(screen.getByText('slovoapp.org/uk/c/abc123defg')).toBeOnTheScreen();
  });

  it('copies on its copy button', async () => {
    const { onCopy, onShare } = await renderSheet();

    await fireEvent.press(screen.getByRole('button', { name: 'Copy the link' }));

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onShare).not.toHaveBeenCalled();
  });

  it('opens the system Share on its second button', async () => {
    const { onCopy, onShare } = await renderSheet();

    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));

    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onCopy).not.toHaveBeenCalled();
  });

  it('keeps the system Share alone when copying is not offered', async () => {
    await renderSheet({ canCopy: false });

    expect(screen.queryByRole('button', { name: 'Copy the link' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Share' })).toBeOnTheScreen();
  });

  it('closes on the cancel button', async () => {
    const { onClose } = await renderSheet();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows nothing with no link', async () => {
    await renderSheet({ url: '' });

    expect(screen.queryByText('As it was when shared.')).toBeNull();
  });
});
