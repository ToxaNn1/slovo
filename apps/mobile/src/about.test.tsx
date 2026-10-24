import { describe, expect, it, jest } from '@jest/globals';
import { EditionProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import AboutScreen from './app/settings/about';
import { edition, editionStrings } from './edition/edition';

/** About as the app routes to it, under the Edition's strings. */
async function renderAbout() {
  await renderRouter(
    {
      _layout: () => (
        <EditionProvider edition={edition} strings={editionStrings}>
          <Slot />
        </EditionProvider>
      ),
      'settings/about': AboutScreen,
    },
    { initialUrl: '/settings/about' },
  );
}

describe('About', () => {
  it.each([
    ['privacy policy', 'about-row-privacy', edition.legalPages.privacy],
    ['terms', 'about-row-terms', edition.legalPages.terms],
  ])("opens the Edition's %s in the browser", async (_page, rowId, address) => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderAbout();

    await fireEvent.press(screen.getByTestId(rowId));

    expect(openURL).toHaveBeenCalledWith(address);
  });
});
