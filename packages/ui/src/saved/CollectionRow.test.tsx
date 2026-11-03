import { coreTokens, CollectionRow, EditionProvider, TokensProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { testStrings } from '../test-strings';

async function renderRow(index = 0) {
  const onPress = jest.fn();
  const onMore = jest.fn();
  await render(
    <GestureHandlerRootView>
      <TokensProvider tokens={coreTokens} colorScheme="light">
        <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
          <CollectionRow
            testID="collection-1"
            index={index}
            name="Nature"
            count="3 entries"
            lemmas={['river']}
            accessibilityLabel="Nature, 3 entries"
            actions={[]}
            more={{ label: 'Actions for “Nature”', onPress: onMore }}
            onPress={onPress}
          />
        </EditionProvider>
      </TokensProvider>
    </GestureHandlerRootView>,
  );
  return { onPress, onMore };
}

describe('CollectionRow', () => {
  it('takes its fill in turn by its place', async () => {
    const { light } = coreTokens.colors;

    await renderRow(1);

    expect(screen.getByRole('button', { name: 'Nature, 3 entries' })).toHaveStyle({
      backgroundColor: light.ink,
    });
    expect(screen.getByText('Nature')).toHaveStyle({ color: light.background });
    expect(screen.getByText('river')).toHaveStyle({ color: light.background });
  });

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
