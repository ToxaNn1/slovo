import { BadgeMark, EditionProvider } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { testStrings } from '../test-strings';

async function draw(
  state: ComponentProps<typeof BadgeMark>['state'],
  shape: ComponentProps<typeof BadgeMark>['shape'] = 'hexagon',
) {
  await render(
    <EditionProvider
      edition={{ locale: 'en' }}
      strings={testStrings({ settings: { badges: { newTag: 'NEW' } } })}
    >
      <BadgeMark testID="badge" shape={shape} tone="red" symbol="7" state={state} size={48} />
    </EditionProvider>,
  );
}

describe('BadgeMark', () => {
  it('shows an earned Badge with its symbol, and the new tag only while it is new', async () => {
    await draw({ kind: 'earned', isNew: true });
    expect(screen.getByTestId('badge-symbol')).toHaveTextContent('7');
    expect(screen.getByTestId('badge-new')).toHaveTextContent('NEW');

    await draw({ kind: 'earned', isNew: false });
    expect(screen.queryByTestId('badge-new')).toBeNull();
  });

  it('shows a Badge not started as a silhouette with no symbol', async () => {
    await draw({ kind: 'locked' });
    expect(screen.getByTestId('badge')).toBeOnTheScreen();
    expect(screen.queryByTestId('badge-symbol')).toBeNull();
    expect(screen.queryByText('7')).toBeNull();
  });

  it('shows a Badge in progress with its symbol and no new tag', async () => {
    await draw({ kind: 'progress', fraction: 0.5 });
    expect(screen.getByTestId('badge-symbol')).toHaveTextContent('7');
    expect(screen.queryByTestId('badge-new')).toBeNull();
  });

  it('draws a checker Badge with its checker in place of the symbol, except as a silhouette', async () => {
    await draw({ kind: 'earned', isNew: false }, 'checker');
    expect(screen.getByTestId('badge-checker')).toBeOnTheScreen();
    expect(screen.queryByTestId('badge-symbol')).toBeNull();

    await draw({ kind: 'progress', fraction: 0.5 }, 'checker');
    expect(screen.getByTestId('badge-checker')).toBeOnTheScreen();
    expect(screen.queryByText('7')).toBeNull();

    await draw({ kind: 'locked' }, 'checker');
    expect(screen.queryByTestId('badge-checker')).toBeNull();
  });

  it('draws no checker on a Badge of another shape', async () => {
    await draw({ kind: 'earned', isNew: false });
    expect(screen.queryByTestId('badge-checker')).toBeNull();
  });
});
