import { EditionProvider, MixCategoryTile } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { testStrings } from '../test-strings';

async function renderInEdition(tile: ReactElement) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      {tile}
    </EditionProvider>,
  );
}

const hint = 'At least one Category stays in the Mix.';

describe('MixCategoryTile', () => {
  it('reads as a chosen button by the Category’s name, with a check, and a press turns it', async () => {
    const onPress = jest.fn();
    await renderInEdition(
      <MixCategoryTile testID="tile" name="Nature" glyph="circle" on onPress={onPress} />,
    );
    const tile = screen.getByRole('button', { name: 'Nature' });
    expect(tile).toBeSelected();
    expect(screen.getByTestId('tile-check')).toBeOnTheScreen();
    await fireEvent.press(tile);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows no check while the Category is out of the Mix', async () => {
    await renderInEdition(
      <MixCategoryTile testID="tile" name="Nature" glyph="circle" on={false} onPress={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Nature' })).not.toBeSelected();
    expect(screen.queryByTestId('tile-check')).toBeNull();
  });

  it('takes no press while disabled and reads why to VoiceOver', async () => {
    const onPress = jest.fn();
    await renderInEdition(
      <MixCategoryTile
        name="Nature"
        glyph="circle"
        on
        disabled
        accessibilityHint={hint}
        onPress={onPress}
      />,
    );
    const tile = screen.getByRole('button', { name: 'Nature' });
    expect(tile).toBeDisabled();
    expect(tile).toHaveProp('accessibilityHint', hint);
    await fireEvent.press(tile);
    expect(onPress).not.toHaveBeenCalled();
  });
});
