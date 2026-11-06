import { BadgeMark, EditionProvider } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

async function draw(earned: boolean) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <BadgeMark testID="badge" shape="hexagon" tone="red" symbol="7" earned={earned} size={48} />
    </EditionProvider>,
  );
}

describe('BadgeMark', () => {
  it('shows an earned Badge with its symbol', async () => {
    await draw(true);
    expect(screen.getByTestId('badge-symbol')).toHaveTextContent('7');
  });

  it('shows a Badge not yet earned as a silhouette with no symbol', async () => {
    await draw(false);
    expect(screen.getByTestId('badge')).toBeOnTheScreen();
    expect(screen.queryByTestId('badge-symbol')).toBeNull();
    expect(screen.queryByText('7')).toBeNull();
  });
});
