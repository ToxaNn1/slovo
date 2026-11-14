import { EditionProvider, SearchLabel } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { testStrings } from '../test-strings';

function InEdition({ children }: { children: ReactNode }) {
  return (
    <EditionProvider
      edition={{ locale: 'en' }}
      strings={testStrings({ search: { clear: 'Clear' } })}
    >
      {children}
    </EditionProvider>
  );
}

describe('SearchLabel', () => {
  it('names the state of Search as a header, with no clear button unless asked', async () => {
    await render(
      <InEdition>
        <SearchLabel testID="label" text="Found" />
      </InEdition>,
    );

    expect(screen.getByRole('header', { name: 'Found' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('clears with its clear button', async () => {
    const clear = jest.fn();
    await render(
      <InEdition>
        <SearchLabel testID="label" text="Recent" onClear={clear} />
      </InEdition>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Clear' }));

    expect(clear).toHaveBeenCalledTimes(1);
  });
});
