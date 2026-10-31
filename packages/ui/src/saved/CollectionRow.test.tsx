import { CollectionRow, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { testStrings } from '../test-strings';

async function renderRow() {
  const onPress = jest.fn();
  const onMore = jest.fn();
  await render(
    <GestureHandlerRootView>
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <CollectionRow
          testID="collection-1"
          name="Nature"
          count="3 entries"
          lemmas={['river']}
          accessibilityLabel="Nature, 3 entries"
          actions={[]}
          more={{ label: 'Actions for “Nature”', onPress: onMore }}
          onPress={onPress}
        />
      </EditionProvider>
    </GestureHandlerRootView>,
  );
  return { onPress, onMore };
}

describe('CollectionRow', () => {
  it('opens the menu from the «…» button without opening the Collection', async () => {
    const { onPress, onMore } = await renderRow();

    await fireEvent.press(screen.getByRole('button', { name: 'Actions for “Nature”' }));

    expect(onMore).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('opens the Collection from a tap on the row without opening the menu', async () => {
    const { onPress, onMore } = await renderRow();

    await fireEvent.press(screen.getByRole('button', { name: 'Nature, 3 entries' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onMore).not.toHaveBeenCalled();
  });
});
