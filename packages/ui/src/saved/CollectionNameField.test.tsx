import { CollectionNameField, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { testStrings } from '../test-strings';

async function renderField(onSubmit: (name: string) => Promise<string | undefined>) {
  const onCancel = jest.fn();
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <CollectionNameField
        overline="Rename"
        placeholder="Name"
        initialName="Birds"
        onSubmit={onSubmit}
        onCancel={onCancel}
        testID="name"
      />
    </EditionProvider>,
  );
  return { onCancel, input: screen.getByLabelText('Name') };
}

describe('CollectionNameField', () => {
  it('keeps one name for a second return while the first is being kept', async () => {
    let settle: (reason: string | undefined) => void = () => undefined;
    const onSubmit = jest.fn(
      () =>
        new Promise<string | undefined>((resolve) => {
          settle = resolve;
        }),
    );
    const { onCancel, input } = await renderField(onSubmit);

    await fireEvent(input, 'submitEditing');
    await fireEvent(input, 'submitEditing');
    await fireEvent(input, 'blur');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    await act(async () => {
      settle(undefined);
      await Promise.resolve();
    });
    await fireEvent(input, 'submitEditing');
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('shows why a name is refused until the name changes', async () => {
    const { input } = await renderField(() => Promise.resolve('Taken'));

    await fireEvent(input, 'submitEditing');
    expect(screen.getByText('Taken')).toBeOnTheScreen();

    await fireEvent.changeText(input, 'Owls');
    expect(screen.queryByText('Taken')).not.toBeOnTheScreen();
  });

  it('leaves the name in the field to try again when keeping it fails', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const onSubmit = jest.fn(() => Promise.reject(new Error('disk')));
    const { input } = await renderField(onSubmit);

    await fireEvent(input, 'submitEditing');
    await fireEvent(input, 'submitEditing');
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(input).toHaveDisplayValue('Birds');
    error.mockRestore();
  });
});
