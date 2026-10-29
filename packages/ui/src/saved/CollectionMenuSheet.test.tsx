import type { EditionStrings } from '@slovo/contracts';
import { CollectionMenuSheet, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const copy = { rename: 'Rename', delete: 'Delete', cancel: 'Cancel' };

async function renderMenu(
  visible = true,
  share?: { label: string; disabled: boolean; disabledHint: string; onPress: () => void },
) {
  const onRename = jest.fn();
  const onDelete = jest.fn();
  const onCancel = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={{} as EditionStrings}>
        <CollectionMenuSheet
          visible={visible}
          copy={copy}
          share={share}
          onRename={onRename}
          onDelete={onDelete}
          onCancel={onCancel}
        />
      </EditionProvider>
    </SafeAreaProvider>,
  );
  return { onRename, onDelete, onCancel };
}

describe('CollectionMenuSheet', () => {
  it('offers rename and delete, and the cancel row last', async () => {
    await renderMenu();

    expect(screen.getByRole('button', { name: 'Rename' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
  });

  it('offers no share row unless it is given one', async () => {
    await renderMenu();

    expect(screen.queryByText('Share a link')).not.toBeOnTheScreen();
  });

  it('offers the share row first and asks to share', async () => {
    const onShare = jest.fn();
    const { onRename, onCancel } = await renderMenu(true, {
      label: 'Share a link',
      disabled: false,
      disabledHint: 'The Collection is empty',
      onPress: onShare,
    });

    expect(
      screen
        .getAllByRole('button', { name: /^(Share a link|Rename|Delete|Cancel)$/ })
        .map((row) => String(row.props['testID'])),
    ).toEqual([
      'collection-menu-share',
      'collection-menu-rename',
      'collection-menu-delete',
      'collection-menu-cancel',
    ]);
    expect(screen.getByRole('button', { name: 'Share a link' }).props).not.toHaveProperty(
      'accessibilityHint',
      'The Collection is empty',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Share a link' }));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onRename).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('dims the share row, says why to VoiceOver and takes no press while it is disabled', async () => {
    const onShare = jest.fn();
    await renderMenu(true, {
      label: 'Share a link',
      disabled: true,
      disabledHint: 'The Collection is empty',
      onPress: onShare,
    });

    const row = screen.getByRole('button', { name: 'Share a link' });
    expect(row).toBeDisabled();
    expect(row).toHaveProp('accessibilityHint', 'The Collection is empty');
    await fireEvent.press(row);
    expect(onShare).not.toHaveBeenCalled();
  });

  it('shows nothing while it is not visible', async () => {
    await renderMenu(false);

    expect(screen.queryByText('Rename')).not.toBeOnTheScreen();
  });

  it('asks to rename without deleting or cancelling', async () => {
    const { onRename, onDelete, onCancel } = await renderMenu();

    await fireEvent.press(screen.getByRole('button', { name: 'Rename' }));

    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('asks to delete without renaming or cancelling', async () => {
    const { onRename, onDelete, onCancel } = await renderMenu();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onRename).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('asks to cancel from the cancel row and from the scrim', async () => {
    const { onRename, onDelete, onCancel } = await renderMenu();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    await fireEvent.press(screen.getByTestId('collection-menu-scrim'));

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onRename).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe('CollectionMenuSheet dismissal', () => {
  const strings = {} as EditionStrings;
  function menu(visible: boolean, onDismissed: () => void) {
    return (
      <SafeAreaProvider initialMetrics={metrics}>
        <EditionProvider edition={{ locale: 'en' }} strings={strings}>
          <CollectionMenuSheet
            visible={visible}
            copy={copy}
            onRename={jest.fn()}
            onDelete={jest.fn()}
            onCancel={jest.fn()}
            onDismissed={onDismissed}
          />
        </EditionProvider>
      </SafeAreaProvider>
    );
  }

  it('says it is dismissed only after it was open and slid away', async () => {
    jest.useFakeTimers();
    const onDismissed = jest.fn();
    const view = await render(menu(false, onDismissed));
    await jest.advanceTimersByTimeAsync(1000);
    expect(onDismissed).not.toHaveBeenCalled();

    await view.rerender(menu(true, onDismissed));
    await jest.advanceTimersByTimeAsync(1000);
    expect(onDismissed).not.toHaveBeenCalled();

    await view.rerender(menu(false, onDismissed));
    await jest.advanceTimersByTimeAsync(1000);
    expect(onDismissed).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
