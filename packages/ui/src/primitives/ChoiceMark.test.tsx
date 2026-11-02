import { EditionProvider } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';
import { ChoiceMark } from './ChoiceMark';

function Mark({ kind, on }: { kind: 'checkbox' | 'radio'; on: boolean }) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <ChoiceMark testID="mark" kind={kind} on={on} />
    </EditionProvider>
  );
}

describe('ChoiceMark', () => {
  it('ticks a checkbox only while it is on', async () => {
    await render(<Mark kind="checkbox" on={false} />);
    expect(screen.queryByTestId('mark-tick')).toBeNull();

    await screen.rerender(<Mark kind="checkbox" on />);

    expect(screen.getByTestId('mark-tick')).toBeOnTheScreen();
    expect(screen.queryByTestId('mark-dot')).toBeNull();
  });

  it('dots a radio only while it is on', async () => {
    await render(<Mark kind="radio" on={false} />);
    expect(screen.queryByTestId('mark-dot')).toBeNull();

    await screen.rerender(<Mark kind="radio" on />);

    expect(screen.getByTestId('mark-dot')).toBeOnTheScreen();
    expect(screen.queryByTestId('mark-tick')).toBeNull();
  });
});
