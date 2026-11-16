import { EditionProvider, SegmentedControl } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { testStrings } from '../test-strings';
import { space } from '../tokens';

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

  it('keeps each label on one line, a long label taking the room it needs (check 15.11)', async () => {
    await render(<ThemeChoice onSelect={jest.fn()} />);

    // Each segment is its label and an equal share of the room left, so «Екран блокування»
    // takes more of the track than «Малий» and keeps to one line.
    expect(screen.getByRole('button', { name: 'Theme: Light' })).toHaveStyle({
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      paddingHorizontal: space[2],
    });
    expect(screen.getByText('Light')).toHaveProp('numberOfLines', 1);
  });
});
