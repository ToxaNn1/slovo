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

async function renderMenu(visible = true) {
  const onRename = jest.fn();
  const onDelete = jest.fn();
  const onCancel = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={{} as EditionStrings}>
        <CollectionMenuSheet
          visible={visible}
          copy={copy}
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
