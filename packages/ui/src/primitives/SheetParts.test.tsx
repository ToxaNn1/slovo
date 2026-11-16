import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { EditionProvider } from '@slovo/ui';
import { SheetTitle } from './SheetParts';
import { testStrings } from '../test-strings';

describe("a bottom sheet's title", () => {
  it('keeps room above it for the end its turn lifts, so a scrolling sheet cuts none of it off', async () => {
    await render(
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <SheetTitle>Report a mistake</SheetTitle>
      </EditionProvider>,
    );
    const title = screen.getByRole('header');

    await fireEvent(title, 'layout', { nativeEvent: { layout: { width: 300, height: 60 } } });

    // Turned by 4.4° about its left end, a band 300 wide lifts its right end 300 × tan 4.4°.
    expect(title).toHaveStyle({ marginTop: 300 * Math.tan((4.4 * Math.PI) / 180) });
  });
});
