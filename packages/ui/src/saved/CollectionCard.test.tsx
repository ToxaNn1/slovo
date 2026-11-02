import { coreTokens, CollectionCard, EditionProvider, TokensProvider, type ColorScheme } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

async function renderCard(index: number, colorScheme: ColorScheme, onPress = jest.fn()) {
  await render(
    <TokensProvider tokens={coreTokens} colorScheme={colorScheme}>
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <CollectionCard
          testID="card"
          index={index}
          name="Nature"
          count="3 entries"
          accessibilityLabel="Nature, 3 entries"
          onPress={onPress}
        />
      </EditionProvider>
    </TokensProvider>,
  );
  return screen.getByRole('button', { name: 'Nature, 3 entries' });
}

describe('CollectionCard', () => {
  it('takes red, ink and sunken in turn by its place, with the dark ink on red in both Themes', async () => {
    const { light, dark } = coreTokens.colors;

    expect(await renderCard(0, 'light')).toHaveStyle({ backgroundColor: light.accent });
    expect(screen.getByText('Nature')).toHaveStyle({ color: light.ink });
    expect(await renderCard(0, 'dark')).toHaveStyle({ backgroundColor: dark.accent });
    expect(screen.getByText('Nature')).toHaveStyle({ color: dark.background });

    expect(await renderCard(1, 'light')).toHaveStyle({ backgroundColor: light.ink });
    expect(screen.getByText('3 entries')).toHaveStyle({ color: light.background });
    expect(await renderCard(2, 'dark')).toHaveStyle({ backgroundColor: dark.surfaceSunken });
    expect(screen.getByText('Nature')).toHaveStyle({ color: dark.ink });
    expect(await renderCard(3, 'light')).toHaveStyle({ backgroundColor: light.accent });
  });

  it('opens the Collection on a tap', async () => {
    const onPress = jest.fn();
    await fireEvent.press(await renderCard(1, 'light', onPress));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
