import { coreTokens, EditionProvider, SavedTabs, TokensProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';
import { savedHeader } from '../tokens';

const tabs = [
  { id: 'favorites', label: 'Favorites', count: 3, accessibilityLabel: 'Favorites, 3 entries' },
  { id: 'history', label: 'History', count: 0, accessibilityLabel: 'History, 0 entries' },
] as const;

async function renderTabs(active: 'favorites' | 'history', onSelect = jest.fn()) {
  await render(
    <TokensProvider tokens={coreTokens} colorScheme="light">
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <SavedTabs testID="saved" tabs={tabs} active={active} onSelect={onSelect} />
      </EditionProvider>
    </TokensProvider>,
  );
  return onSelect;
}

describe('SavedTabs', () => {
  it('marks the active tab selected, with no bar under it', async () => {
    await renderTabs('history');

    expect(screen.getByRole('button', { name: 'History, 0 entries' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Favorites, 3 entries' })).not.toBeSelected();
    expect(screen.queryByTestId('saved-indicator')).toBeNull();
  });

  it('shows the count of each tab beside its label', async () => {
    await renderTabs('favorites');

    expect(screen.getByTestId('saved-favorites')).toHaveTextContent('Favorites3');
    expect(screen.getByTestId('saved-history')).toHaveTextContent('History0');
  });

  it('fades the row out at its right edge into the background', async () => {
    await renderTabs('favorites');

    expect(screen.getByTestId('saved-fade')).toHaveStyle({
      position: 'absolute',
      right: 0,
      width: savedHeader.fade,
    });
  });

  it('takes only the height of its chips, so the list under it starts at the top', async () => {
    // A ScrollView grows by default; in the Saved column it would split the
    // height with the list and push the list's rows to the middle.
    await renderTabs('favorites');

    expect(screen.getByTestId('saved-row')).toHaveStyle({ flexGrow: 0 });
  });

  it('asks to show the list of the tab tapped', async () => {
    const onSelect = await renderTabs('history');

    await fireEvent.press(screen.getByTestId('saved-favorites'));

    expect(onSelect).toHaveBeenCalledWith('favorites');
  });
});
