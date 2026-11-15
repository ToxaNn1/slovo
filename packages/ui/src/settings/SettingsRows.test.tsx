import {
  ChoiceRow,
  EditionProvider,
  NavigationRow,
  SettingsActionCard,
  SettingsGroup,
  SettingsRow,
  SwitchRow,
} from '@slovo/ui';
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

describe('Settings row', () => {
  it('opens a screen from its chevron end, read with its value and its subtitle as the hint', async () => {
    const onPress = jest.fn();
    await render(
      <Providers>
        <SettingsRow
          testID="row"
          icon="diamond"
          label="Notifications"
          subtitle="Word of the day reminder"
          end={{ kind: 'chevron', value: '09:00', onPress }}
        />
      </Providers>,
    );

    const row = screen.getByRole('button', { name: 'Notifications, 09:00' });
    expect(row).toHaveProp('accessibilityHint', 'Word of the day reminder');
    expect(screen.getByText('09:00')).toBeOnTheScreen();
    expect(screen.getByTestId('row-chevron')).toBeOnTheScreen();
    await fireEvent.press(row);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('turns its switch end on, read once at the switch with its subtitle as the hint', async () => {
    const onChange = jest.fn();
    await render(
      <Providers>
        <SettingsRow
          icon="triangle"
          label="Sounds"
          subtitle="A shout on the reveal"
          end={{ kind: 'switch', value: false, onChange }}
        />
      </Providers>,
    );

    const toggle = screen.getByRole('switch', { name: 'Sounds' });
    expect(toggle).toHaveProp('accessibilityHint', 'A shout on the reveal');
    await fireEvent.press(toggle);

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('runs its plain action end, with no value and no chevron', async () => {
    const onPress = jest.fn();
    await render(
      <Providers>
        <SettingsRow
          testID="row"
          icon="bar"
          label="Retake the test"
          subtitle="Ten words"
          end={{ kind: 'action', onPress }}
        />
      </Providers>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Retake the test' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('row-chevron')).toBeNull();
  });
});

describe('Settings action card', () => {
  it('runs its action when pressed, read by its label', async () => {
    const onPress = jest.fn();
    await render(
      <Providers>
        <SettingsActionCard testID="reset" label="Reset progress" onPress={onPress} />
      </Providers>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Reset progress' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
