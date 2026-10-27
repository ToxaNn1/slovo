import type { EditionStrings } from '@slovo/contracts';
import { EditionProvider, SearchButton } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

describe('SearchButton', () => {
  it('is a button VoiceOver reads by the name of Search, and opens it on a press', async () => {
    const onPress = jest.fn();
    await render(
      <EditionProvider
        edition={{ locale: 'en' }}
        strings={{ search: { title: 'Search' } } as EditionStrings}
      >
        <SearchButton onPress={onPress} />
      </EditionProvider>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Search' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
