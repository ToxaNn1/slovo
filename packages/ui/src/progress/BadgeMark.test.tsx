import { BadgeMark, EditionProvider, TokensProvider, coreTokens } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { processColor } from 'react-native';
import { testStrings } from '../test-strings';

/** Core tokens with a cream-on-ink dark Theme and a red accent, as the Edition's. */
const tokens = {
  ...coreTokens,
  colors: {
    light: { ...coreTokens.colors.light, ink: '#140C0A', background: '#FFF4E6', accent: '#FF3B2F' },
    dark: { ...coreTokens.colors.dark, ink: '#FFF4E6', background: '#140C0A', accent: '#FF3B2F' },
  },
};

async function draw(
  state: ComponentProps<typeof BadgeMark>['state'],
  {
    shape = 'hexagon',
    tone = 'red',
    scheme = 'light',
  }: {
    shape?: ComponentProps<typeof BadgeMark>['shape'];
    tone?: ComponentProps<typeof BadgeMark>['tone'];
    scheme?: ComponentProps<typeof TokensProvider>['colorScheme'];
  } = {},
) {
  await render(
    <TokensProvider tokens={tokens} colorScheme={scheme}>
      <EditionProvider
        edition={{ locale: 'en' }}
        strings={testStrings({ settings: { badges: { newTag: 'NEW' } } })}
      >
        <BadgeMark testID="badge" shape={shape} tone={tone} symbol="7" state={state} size={100} />
      </EditionProvider>
    </TokensProvider>,
  );
}

/** The colour the earned face is painted in, as the renderer holds it. */
function faceColor() {
  const fill: unknown = screen.getByTestId('badge-face').props['fill'];
  return typeof fill === 'object' && fill !== null && 'payload' in fill ? fill.payload : fill;
}

describe('BadgeMark', () => {
  it('shows an earned Badge with its symbol, and the new tag only while it is new', async () => {
    await draw({ kind: 'earned', isNew: true });
    expect(screen.getByTestId('badge-symbol')).toHaveTextContent('7');
    expect(screen.getByTestId('badge-new')).toHaveTextContent('NEW');

    await draw({ kind: 'earned', isNew: false });
    expect(screen.queryByTestId('badge-new')).toBeNull();
  });

  it('shows a locked Badge as its shape alone: no symbol to read, no new tag', async () => {
    await draw({ kind: 'locked' });
    expect(screen.getByTestId('badge')).toBeOnTheScreen();
    expect(screen.queryByTestId('badge-symbol')).toBeNull();
    expect(screen.queryByText('7')).toBeNull();
    expect(screen.queryByTestId('badge-new')).toBeNull();
    expect(screen.queryByTestId('badge-progress')).toBeNull();
  });

  it('shows a Badge in progress with no symbol, its fill rising inside the ring only', async () => {
    await draw({ kind: 'progress', fraction: 0.5 });
    expect(screen.queryByText('7')).toBeNull();
    expect(screen.queryByTestId('badge-new')).toBeNull();

    // The face is the shape set 7 in from each edge of the 100 side: 86 square.
    expect(screen.getByTestId('badge-progress')).toHaveStyle({ width: 86, height: 43, top: 50 });
  });

  it('draws the ink tone in the Theme ink with a red symbol, so it reads in the dark Theme', async () => {
    await draw({ kind: 'earned', isNew: false }, { tone: 'ink', scheme: 'dark' });
    expect(faceColor()).toBe(processColor('#FFF4E6'));
    expect(screen.getByTestId('badge-symbol')).toHaveStyle({ color: '#FF3B2F' });

    await draw({ kind: 'earned', isNew: false }, { tone: 'ink', scheme: 'light' });
    expect(faceColor()).toBe(processColor('#140C0A'));
  });

  it('draws a checker Badge with its checker in place of the symbol once earned', async () => {
    await draw({ kind: 'earned', isNew: false }, { shape: 'checker' });
    expect(screen.getByTestId('badge-checker')).toBeOnTheScreen();
    expect(screen.queryByTestId('badge-symbol')).toBeNull();

    await draw({ kind: 'progress', fraction: 0.5 }, { shape: 'checker' });
    expect(screen.queryByTestId('badge-checker')).toBeNull();

    await draw({ kind: 'locked' }, { shape: 'checker' });
    expect(screen.queryByTestId('badge-checker')).toBeNull();
  });

  it('draws no checker on a Badge of another shape', async () => {
    await draw({ kind: 'earned', isNew: false });
    expect(screen.getByTestId('badge-symbol')).toHaveTextContent('7');
    expect(screen.queryByTestId('badge-checker')).toBeNull();
  });
});
