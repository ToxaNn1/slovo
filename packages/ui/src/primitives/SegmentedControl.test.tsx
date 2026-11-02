import { EditionProvider, SegmentedControl } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { testStrings } from '../test-strings';

type Theme = 'light' | 'dark';

function ThemeChoice({ onSelect }: { onSelect: (theme: Theme) => void }) {
  const [theme, setTheme] = useState<Theme>('light');
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <SegmentedControl<Theme>
        accessibilityLabel="Theme"
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
    </EditionProvider>
  );
}

describe('SegmentedControl', () => {
  it('reads each segment with the choice it makes and marks the selected one', async () => {
    await render(<ThemeChoice onSelect={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Theme: Light' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Theme: Dark' })).not.toBeSelected();
  });

  it('selects the segment pressed, and asks nothing for the one already selected', async () => {
    const onSelect = jest.fn();
    await render(<ThemeChoice onSelect={onSelect} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Theme: Light' }));
    expect(onSelect).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Theme: Dark' }));
    expect(onSelect).toHaveBeenCalledWith('dark');
    expect(screen.getByRole('button', { name: 'Theme: Dark' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Theme: Light' })).not.toBeSelected();
  });
});
