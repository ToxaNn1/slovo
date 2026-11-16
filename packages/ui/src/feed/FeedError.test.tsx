import { EditionProvider, FeedError, TornThread } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

async function renderError(onRetry: () => void, withArt = true) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <FeedError
        title="The thread broke"
        message="The dictionary did not open."
        retry="Again"
        onRetry={onRetry}
        art={withArt ? <TornThread /> : undefined}
      />
    </EditionProvider>,
  );
}

describe('FeedError', () => {
  it('reads its title and message as one alert and tries again on its button', async () => {
    const onRetry = jest.fn();
    await renderError(onRetry);

    expect(screen.getByLabelText('The thread broke. The dictionary did not open.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('draws the torn thread over the title when it is given', async () => {
    await renderError(() => undefined);

    expect(screen.getByTestId('torn-thread')).toBeTruthy();
  });

  it('draws no art without it', async () => {
    await renderError(() => undefined, false);

    expect(screen.queryByTestId('torn-thread')).toBeNull();
  });
});
