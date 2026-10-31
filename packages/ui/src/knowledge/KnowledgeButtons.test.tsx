import { EditionProvider, KnowledgeButtons } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({ knowledge: { known: 'Known', unknown: 'Unknown' } });

function buttons(
  mark: 'known' | 'unknown' | undefined,
  onTap: (mark: 'known' | 'unknown') => void,
) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <KnowledgeButtons entryKind="word" mark={mark} onTap={onTap} />
    </EditionProvider>
  );
}

describe('KnowledgeButtons', () => {
  it('shows both buttons unselected for an Entry with no mark', async () => {
    await render(buttons(undefined, jest.fn()));

    for (const name of ['Known', 'Unknown']) {
      expect(screen.getByRole('button', { name, selected: false })).toBeTruthy();
    }
  });

  it('highlights the chosen mark and no other', async () => {
    await render(buttons('unknown', jest.fn()));

    expect(screen.getByRole('button', { name: 'Unknown', selected: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Known', selected: false })).toBeTruthy();
  });

  it('marks the Entry with the tapped button', async () => {
    const onTap = jest.fn();
    await render(buttons(undefined, onTap));

    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));

    expect(onTap).toHaveBeenCalledWith('known');
  });

  it('changes the mark when the other button is tapped', async () => {
    const onTap = jest.fn();
    await render(buttons('known', onTap));

    await fireEvent.press(screen.getByRole('button', { name: 'Unknown' }));

    expect(onTap).toHaveBeenCalledWith('unknown');
  });

  it('gives Known no hint on a Word', async () => {
    await render(buttons(undefined, jest.fn()));

    expect(screen.getByRole('button', { name: 'Known' })).toBeTruthy();
    expect(screen.queryAllByHintText(/./)).toHaveLength(0);
  });

  it('taps the chosen button again to remove its mark', async () => {
    const onTap = jest.fn();
    await render(buttons('known', onTap));

    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));

    expect(onTap).toHaveBeenCalledWith('known');
  });
});
