import { EditionProvider, SearchField, fontScaleCap } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { testStrings } from '../test-strings';

function Search() {
  const [query, setQuery] = useState('');
  return (
    <EditionProvider
      edition={{ locale: 'en' }}
      strings={testStrings({ search: { clear: 'Clear' } })}
    >
      <SearchField testID="search" label="Search" value={query} onChangeText={setQuery} />
    </EditionProvider>
  );
}

describe('SearchField', () => {
  it('names the field by its label and offers no clear button while it is empty', async () => {
    await render(<Search />);

    expect(screen.getByLabelText('Search')).toHaveDisplayValue('');
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('clears the query with its clear button', async () => {
    await render(<Search />);
    await fireEvent.changeText(screen.getByLabelText('Search'), 'gre');
    expect(screen.getByLabelText('Search')).toHaveDisplayValue('gre');

    await fireEvent.press(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByLabelText('Search')).toHaveDisplayValue('');
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('caps the query’s Dynamic Type so the box never clips it', async () => {
    await render(<Search />);

    expect(screen.getByLabelText('Search')).toHaveProp('maxFontSizeMultiplier', fontScaleCap.text);
  });
});
