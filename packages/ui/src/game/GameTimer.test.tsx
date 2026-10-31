import { EditionProvider, GameTimer } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { testStrings } from '../test-strings';

const texts = { remaining: (seconds: number) => `${String(seconds)} seconds left` };

function Timer({ remainingMs }: { remainingMs: number }) {
  return (
    <EditionProvider edition={{ locale: 'uk' }} strings={testStrings({})}>
      <GameTimer remainingMs={remainingMs} totalMs={60_000} texts={texts} testID="timer" />
    </EditionProvider>
  );
}

describe('GameTimer', () => {
  let announce: jest.SpiedFunction<typeof AccessibilityInfo.announceForAccessibility>;
  beforeEach(() => {
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockReturnValue();
  });
  afterEach(() => {
    announce.mockRestore();
  });

  it('shows the whole seconds left, counted up, and reads them by name', async () => {
    await render(<Timer remainingMs={39_200} />);

    expect(screen.getByText('40')).toBeTruthy();
    expect(screen.getByLabelText('40 seconds left')).toBeTruthy();
  });

  it('never shows less than none', async () => {
    await render(<Timer remainingMs={-300} />);

    expect(screen.getByText('0')).toBeTruthy();
  });

  it('announces the time left as each ten seconds pass, and only then', async () => {
    const view = await render(<Timer remainingMs={60_000} />);
    for (let ms = 59_500; ms >= 0; ms -= 500) await view.rerender(<Timer remainingMs={ms} />);

    expect(announce.mock.calls.map(([text]) => text)).toEqual([
      '50 seconds left',
      '40 seconds left',
      '30 seconds left',
      '20 seconds left',
      '10 seconds left',
    ]);
  });

  it('announces once when a jump skips a ten, and not again as the same time is drawn', async () => {
    const view = await render(<Timer remainingMs={42_000} />);
    await view.rerender(<Timer remainingMs={38_000} />);
    await view.rerender(<Timer remainingMs={38_000} />);
    await view.rerender(<Timer remainingMs={37_500} />);

    expect(announce.mock.calls.map(([text]) => text)).toEqual(['38 seconds left']);
  });
});
