import { EditionProvider, SettingsHeader } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { testStrings } from '../test-strings';

function Providers({ children }: { children: ReactNode }) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      {children}
    </EditionProvider>
  );
}

describe('Settings header', () => {
  it('names the screen as its header and goes back from the tile', async () => {
    const onPress = jest.fn();
    await render(
      <Providers>
        <SettingsHeader
          kind="settings"
          title="Settings"
          back={{ label: 'Profile', onPress, testID: 'settings-back' }}
        />
      </Providers>,
    );
    expect(screen.getByRole('header', { name: 'Settings' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Profile' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('draws no back tile when there is nowhere to go back to', async () => {
    await render(
      <Providers>
        <SettingsHeader kind="subScreen" title="About" />
      </Providers>,
    );
    expect(screen.getByRole('header', { name: 'About' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
