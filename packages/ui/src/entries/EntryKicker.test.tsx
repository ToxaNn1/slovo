import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { EditionProvider, EntryKicker } from '@slovo/ui';
import { testStrings } from '../test-strings';
import { entryCardFrame, typeRoles } from '../tokens';

describe("an Entry card's kicker (board XEntry2)", () => {
  it('reads its label as written and sets it in the card kicker role beside the red wedge', async () => {
    await render(
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <EntryKicker testID="correction-kicker" label="Correction" />
      </EditionProvider>,
    );

    const kicker = screen.getByTestId('correction-kicker');
    expect(kicker).toHaveProp('accessibilityLabel', 'Correction');
    expect(StyleSheet.flatten(screen.getByText('Correction').props['style'])).toMatchObject({
      fontSize: typeRoles.cardKicker.size,
      fontWeight: typeRoles.cardKicker.weight,
      letterSpacing: typeRoles.cardKicker.letterSpacing,
      textTransform: 'uppercase',
    });
    expect(screen.getByTestId('correction-kicker-wedge')).toBeTruthy();
    expect(StyleSheet.flatten(kicker.props['style'])).toMatchObject({
      flexDirection: 'row',
      gap: entryCardFrame.kicker.gap,
    });
  });

  it("lowers its tight line on iOS so its capitals sit level with the corner tiles' middle, as on the board", async () => {
    await render(
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <EntryKicker testID="correction-kicker" label="Correction" />
      </EditionProvider>,
    );

    // Unbounded's ascent .995 and descent .245 em: iOS lays the 11 pt line from its foot,
    // (1.24 × 11 − 11) / 2 pt above where the board's CSS centres it.
    expect(StyleSheet.flatten(screen.getByText('Correction').props['style'])).toMatchObject({
      transform: [{ translateY: 1.32 }],
    });
  });
});
