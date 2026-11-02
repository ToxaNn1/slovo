import { ChoiceRow, EditionProvider, NavigationRow, SettingsGroup, SwitchRow } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';
import { testStrings } from '../test-strings';

type Theme = 'light' | 'dark';

function Providers({ children }: { children: ReactNode }) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      {children}
    </EditionProvider>
  );
}

function ThemeRow({ onSelect }: { onSelect: (theme: Theme) => void }) {
  const [theme, setTheme] = useState<Theme>('light');
  return (
    <ChoiceRow<Theme>
      icon="hex"
      label="Theme"
      subtitle="Light and dark are equal"
      segments={[
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ]}
      selected={theme}
      onSelect={(value) => {
        setTheme(value);
        onSelect(value);
      }}
    />
  );
}

describe('Settings rows', () => {
  it('heads a group with its title', async () => {
    await render(
      <Providers>
        <SettingsGroup title="Look">
          <NavigationRow icon="triangle" label="About" onPress={jest.fn()} />
        </SettingsGroup>
      </Providers>,
    );

    expect(screen.getByRole('header', { name: 'Look' })).toBeOnTheScreen();
  });

  it('opens a screen from a row with an icon, read with its value', async () => {
    const onPress = jest.fn();
    await render(
      <Providers>
        <SettingsGroup>
          <NavigationRow icon="triangle" label="Notifications" value="09:00" onPress={onPress} />
        </SettingsGroup>
      </Providers>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Notifications, 09:00' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('turns a switch row with an icon on, read once at its switch', async () => {
    const onChange = jest.fn();
    await render(
      <Providers>
        <SwitchRow icon="wedge" label="Decor" value={false} onChange={onChange} />
      </Providers>,
    );

    await fireEvent.press(screen.getByRole('switch', { name: 'Decor' }));

    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.queryByText('Decor', { includeHiddenElements: false })).toBeNull();
  });

  it('picks a value in a choice row, read by the row label', async () => {
    const onSelect = jest.fn();
    await render(
      <Providers>
        <ThemeRow onSelect={onSelect} />
      </Providers>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Theme: Dark' }));

    expect(onSelect).toHaveBeenCalledWith('dark');
    expect(screen.getByRole('button', { name: 'Theme: Dark' })).toBeSelected();
  });
});
