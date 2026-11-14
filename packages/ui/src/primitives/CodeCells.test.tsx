import { CodeCells, EditionProvider } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { testStrings } from '../test-strings';

function Code({ onCode = () => undefined }: { onCode?: (code: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <CodeCells
        testID="code"
        label="Code from the email"
        digits={6}
        value={value}
        onChangeText={(code) => {
          setValue(code);
          onCode(code);
        }}
      />
    </EditionProvider>
  );
}

const cells = () =>
  Array.from({ length: 6 }, (_, i) => screen.getByTestId(`code-cell-${i}`, { includeHiddenElements: true }).props.children);

describe('CodeCells', () => {
  it('fills all six cells from one pasted code', async () => {
    const typed: string[] = [];
    await render(<Code onCode={(code) => typed.push(code)} />);

    await fireEvent.changeText(screen.getByLabelText('Code from the email'), '123 456');

    expect(typed).toEqual(['123456']);
    expect(cells()).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('keeps the one field that mail and SMS autofill fill', async () => {
    await render(<Code />);

    const field = screen.getByLabelText('Code from the email');
    expect(field.props.textContentType).toBe('oneTimeCode');
    expect(field.props.autoComplete).toBe('one-time-code');
  });

  it('takes no more digits than its cells', async () => {
    await render(<Code />);

    await fireEvent.changeText(screen.getByLabelText('Code from the email'), '12345678');

    expect(cells()).toEqual(['1', '2', '3', '4', '5', '6']);
  });
});
