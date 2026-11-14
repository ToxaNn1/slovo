import { EditionProvider, WidgetPreviews } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({});

/** The drawing is a picture VoiceOver skips, so its queries look among hidden elements. */
const HIDDEN = { includeHiddenElements: true };

const NAMES = { small: 'Small', medium: 'Medium', lockScreen: 'Lock Screen' };

async function renderPreviews(lockScreen: boolean) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <WidgetPreviews
        testID="previews"
        names={NAMES}
        lockScreen={lockScreen}
        mode="ALL WORDS"
        lemma="word"
        definition="a short line"
      />
    </EditionProvider>,
  );
}

describe('WidgetPreviews', () => {
  it('opens on the medium widget and flips to each size the reader taps', async () => {
    await renderPreviews(true);
    expect(screen.getByTestId('previews-widget-medium', HIDDEN)).toHaveTextContent(/a short line/);

    await fireEvent.press(screen.getByTestId('previews-small'));
    expect(screen.getByTestId('previews-widget-small', HIDDEN)).toHaveTextContent(/word/);
    expect(screen.queryByTestId('previews-widget-medium', HIDDEN)).toBeNull();
    expect(screen.getByTestId('previews-small')).toBeSelected();

    await fireEvent.press(screen.getByTestId('previews-lockScreen'));
    expect(screen.getByTestId('previews-widget-lockScreen', HIDDEN)).toHaveTextContent(/word/);
  });

  it('offers the lock-screen preview only when it is given', async () => {
    await renderPreviews(false);
    expect(screen.getByText('Small')).toBeOnTheScreen();
    expect(screen.getByText('Medium')).toBeOnTheScreen();
    expect(screen.queryByText('Lock Screen')).toBeNull();
  });

  it('marks no preview with a ✓, as nothing is chosen for good', async () => {
    await renderPreviews(true);
    expect(screen.queryByText('✓')).toBeNull();
    expect(screen.queryByTestId('choice-mark')).toBeNull();
  });
});
