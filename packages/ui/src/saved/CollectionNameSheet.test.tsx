import { CollectionNameSheet, coreTokens, EditionProvider, TokensProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const strings = testStrings({
  collections: {
    sheet: { namePlaceholder: 'Collection name', nameFailed: 'Could not keep it.' },
    nameSheet: {
      newTitle: 'New collection',
      renameTitle: 'Rename',
      counter: '{count}/{max}',
      create: 'Create',
      save: 'Save',
      cancel: 'Cancel',
    },
  },
});

type Submit = (name: string) => Promise<string | undefined>;

function sheet(props: {
  visible?: boolean;
  kind?: 'new' | 'rename';
  initialName?: string;
  onSubmit: Submit;
  onClose?: () => void;
}) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <TokensProvider tokens={coreTokens} colorScheme="light">
        <EditionProvider edition={{ locale: 'en' }} strings={strings}>
          <CollectionNameSheet
            visible={props.visible ?? true}
            kind={props.kind ?? 'new'}
            initialName={props.initialName}
            onSubmit={props.onSubmit}
            onClose={props.onClose ?? jest.fn()}
          />
        </EditionProvider>
      </TokensProvider>
    </SafeAreaProvider>
  );
}

const input = () => screen.getByLabelText('Collection name');
const counter = () => screen.getByTestId('collection-name-counter');

describe('CollectionNameSheet', () => {
  it('names a new Collection: the plate, the counter as the name grows, and «Create»', async () => {
    const onSubmit = jest.fn<Submit>().mockResolvedValue(undefined);
    await render(sheet({ onSubmit }));

    expect(screen.getByRole('header', { name: 'New collection' })).toBeOnTheScreen();
    expect(counter()).toHaveTextContent('0/40');
    await fireEvent.changeText(input(), '  For essays ');
    expect(counter()).toHaveTextContent('10/40');
    await fireEvent.press(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).toHaveBeenCalledWith('  For essays ');
    expect(screen.queryByTestId('collection-name-refusal')).not.toBeOnTheScreen();
  });

  it('turns the counter red past 40 characters', async () => {
    await render(sheet({ onSubmit: jest.fn<Submit>().mockResolvedValue(undefined) }));

    await fireEvent.changeText(input(), 'a'.repeat(40));
    expect(counter()).toHaveStyle({ color: coreTokens.colors.light.muted });
    await fireEvent.changeText(input(), 'a'.repeat(41));
    expect(counter()).toHaveTextContent('41/40');
    expect(counter()).toHaveStyle({ color: coreTokens.colors.light.accentText });
  });

  it('shows the refusal under a red field, keeps the name, and drops the refusal on typing', async () => {
    const onSubmit = jest.fn<Submit>().mockResolvedValue('Give it a name.');
    await render(sheet({ onSubmit }));

    await fireEvent(input(), 'submitEditing');

    expect(await screen.findByText('Give it a name.')).toBeOnTheScreen();
    expect(screen.getByTestId('collection-name-field')).toHaveStyle({
      borderColor: coreTokens.colors.light.accentText,
    });
    await fireEvent.changeText(input(), 'Autumn');
    expect(screen.queryByText('Give it a name.')).not.toBeOnTheScreen();
    expect(input()).toHaveDisplayValue('Autumn');
  });

  it('says the name could not be kept when keeping it fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await render(sheet({ onSubmit: jest.fn<Submit>().mockRejectedValue(new Error('disk')) }));

    await fireEvent.press(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Could not keep it.')).toBeOnTheScreen();
  });

  it('renames with the field filled and «Save»', async () => {
    const onSubmit = jest.fn<Submit>().mockResolvedValue(undefined);
    await render(sheet({ kind: 'rename', initialName: 'Autumn words', onSubmit }));

    expect(screen.getByRole('header', { name: 'Rename' })).toBeOnTheScreen();
    expect(input()).toHaveDisplayValue('Autumn words');
    expect(counter()).toHaveTextContent('12/40');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith('Autumn words');
  });

  it('starts again from the name given each time it opens', async () => {
    const onSubmit = jest.fn<Submit>().mockResolvedValue(undefined);
    const view = await render(sheet({ initialName: 'Autumn', onSubmit }));
    await fireEvent.changeText(input(), 'Winter');

    await view.rerender(sheet({ visible: false, initialName: 'Autumn', onSubmit }));
    await view.rerender(sheet({ initialName: 'Autumn', onSubmit }));

    expect(input()).toHaveDisplayValue('Autumn');
  });

  it('asks to close from «Cancel»', async () => {
    const onClose = jest.fn();
    await render(sheet({ onSubmit: jest.fn<Submit>(), onClose }));

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
