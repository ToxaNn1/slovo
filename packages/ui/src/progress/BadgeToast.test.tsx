import { BadgeToast, coreTokens, EditionProvider, ReduceMotionProvider, TokensProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { testStrings } from '../test-strings';

/** The toast of a Badge earned during a Game. */
async function draw(scheme: 'light' | 'dark' = 'light') {
  await render(
    <TokensProvider tokens={coreTokens} colorScheme={scheme}>
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <ReduceMotionProvider reduceMotion={false}>
          <BadgeToast
            shape="hexagon"
            tone="ink"
            symbol="7"
            name="A week"
            line="A new Badge, yours for good."
          />
        </ReduceMotionProvider>
      </EditionProvider>
    </TokensProvider>,
  );
}

describe('BadgeToast', () => {
  it('shows the Badge’s mark, its name and the line, and takes no touch', async () => {
    await draw();
    // VoiceOver hears the toast once, from its announcement, so the toast itself is hidden.
    const hidden = { includeHiddenElements: true };
    expect(screen.getByTestId('badge-toast-mark-symbol', hidden)).toHaveTextContent('7');
    expect(screen.getByText('A week', hidden)).toBeOnTheScreen();
    expect(screen.getByText('A new Badge, yours for good.', hidden)).toBeOnTheScreen();
    expect(screen.getByTestId('badge-toast', hidden)).toHaveProp('pointerEvents', 'none');
  });

  it('tells VoiceOver the Badge’s name and the line', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await draw();
    expect(announce).toHaveBeenCalledWith('A week. A new Badge, yours for good.');
    announce.mockRestore();
  });

  // Decision 22: the toast is the Theme's ink with the screen's ground for its words, so it inverts in dark.
  it.each(['light', 'dark'] as const)('reads in the %s Theme', async (scheme) => {
    await draw(scheme);
    const hidden = { includeHiddenElements: true };
    const { ink, background } = coreTokens.colors[scheme];
    expect(screen.getByTestId('badge-toast', hidden)).toHaveStyle({ backgroundColor: ink });
    for (const text of ['A week', 'A new Badge, yours for good.']) {
      expect(screen.getByText(text, hidden)).toHaveStyle({ color: background });
    }
  });
});
