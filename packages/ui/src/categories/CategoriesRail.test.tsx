import { describe, expect, it, jest } from '@jest/globals';
import {
  CategoriesRail,
  coreTokens,
  EditionProvider,
  TokensProvider,
  type DesignTokens,
  type GridTile,
} from '@slovo/ui';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { testStrings } from '../test-strings';

const tiles: GridTile[] = [
  { id: 'nature', name: 'Nature' },
  { id: 'feelings', name: 'Feelings' },
  { id: 'war', name: 'Military affairs' },
];

const editionTokens: DesignTokens = {
  ...coreTokens,
  colors: {
    light: { ...coreTokens.colors.light, accent: '#D7261E' },
    dark: { ...coreTokens.colors.dark, accent: '#D7261E' },
  },
};

async function renderRail(scheme: 'light' | 'dark', onOpen = jest.fn()) {
  await render(
    <TokensProvider tokens={editionTokens} colorScheme={scheme}>
      <EditionProvider
        edition={{ locale: 'en' }}
        strings={testStrings({ dashboard: { categories: { title: 'Categories' } } })}
      >
        <CategoriesRail
          tiles={tiles}
          toneAt={(index) => (index === 2 ? 'quietRail' : 'red')}
          onOpenAll={() => undefined}
          onOpen={onOpen}
        />
      </EditionProvider>
    </TokensProvider>,
  );
  return onOpen;
}

const styleOf = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID).props['style']) as {
    backgroundColor?: string;
    color?: string;
  };

describe('CategoriesRail with a quiet Category', () => {
  it.each(['light', 'dark'] as const)(
    'mutes the quiet tile in the %s theme: the light ink ground, the name in the light background',
    async (scheme) => {
      await renderRail(scheme);

      const light = editionTokens.colors.light;
      expect(styleOf('dashboard-category-war-face').backgroundColor).toBe(light.ink);
      expect(styleOf('dashboard-category-war-name').color).toBe(light.background);
      expect(styleOf('dashboard-category-nature-face').backgroundColor).toBe(
        editionTokens.colors[scheme].accent,
      );
    },
  );

  it('opens the quiet Category on a tap like any other', async () => {
    const onOpen = await renderRail('light');

    await fireEvent.press(screen.getByLabelText('Military affairs'));

    expect(onOpen).toHaveBeenCalledWith('war');
  });
});
