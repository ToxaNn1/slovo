import type { Mood } from '@slovo/contracts';
import type { MoodBlock } from '@slovo/core';
import { EditionProvider, MoodCheckIn, UndoToastProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({ dashboard: { mood: { question: 'How are you?', note: 'Mood' } } });

function mood(id: string): Mood {
  return { id, name: id, emoji: '·', reply: `${id}!`, rarityBand: 'whole', shifts: {} };
}

async function show(ids: readonly string[], check: MoodBlock['check'] = { state: 'asking' }) {
  const block: MoodBlock = { kind: 'mood', moods: ids.map(mood), check };
  const onChoose = jest.fn();
  const onUnpick = jest.fn();
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <UndoToastProvider>
        <MoodCheckIn block={block} onChoose={onChoose} onUnpick={onUnpick} />
      </UndoToastProvider>
    </EditionProvider>,
  );
  return { onChoose, onUnpick };
}

describe('MoodCheckIn', () => {
  it('with five Moods, keeps the fifth tile half a row wide beside an empty cell', async () => {
    await show(['energetic', 'joyful', 'sad', 'in-love', 'calm']);

    expect(screen.getAllByRole('button')).toHaveLength(5);
    const empty = screen.getByTestId('dashboard-mood-empty');
    const lastRow = empty.parent;
    if (lastRow === null) throw new Error('The empty cell has no row');
    expect(within(lastRow).getByTestId('dashboard-mood-calm')).toBeTruthy();
    expect(within(lastRow).queryByTestId('dashboard-mood-in-love')).toBeNull();
  });

  it('with four Moods, fills both rows with no empty cell', async () => {
    await show(['energetic', 'joyful', 'sad', 'calm']);

    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.queryByTestId('dashboard-mood-empty')).toBeNull();
  });

  it('with three Moods, sets them in one row with no empty cell', async () => {
    await show(['energetic', 'joyful', 'calm']);

    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByTestId('dashboard-mood-empty')).toBeNull();
    const row = screen.getByTestId('dashboard-mood-energetic').parent?.parent;
    if (row === null || row === undefined) throw new Error('The tile has no row');
    expect(within(row).getByTestId('dashboard-mood-calm')).toBeTruthy();
  });

  it('sets a name on its own line box, so it centres on its mark as on the board', async () => {
    await show(['energetic']);

    const name = screen.getByText('energetic');
    expect(name).toHaveStyle({ fontSize: 15 });
    // A line height under the font's own drops the glyphs below the mark on iOS.
    expect(name).not.toHaveStyle({ lineHeight: 15 });
  });

  it('says the chosen Mood’s effect under the tiles, and a tap on the chosen tile unpicks it with no toast', async () => {
    const { onChoose, onUnpick } = await show(['energetic', 'joyful', 'calm'], {
      state: 'chosen',
      mood: mood('joyful'),
      effect: 'More idioms.',
    });

    expect(screen.getByText('More idioms.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('dashboard-mood-joyful'));

    expect(onUnpick).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
    expect(screen.queryByText('joyful!')).toBeNull();
  });

  it('with an effect, a tap on another tile still chooses it', async () => {
    const { onChoose, onUnpick } = await show(['energetic', 'joyful', 'calm'], {
      state: 'chosen',
      mood: mood('joyful'),
      effect: 'More idioms.',
    });

    await fireEvent.press(screen.getByTestId('dashboard-mood-calm'));

    expect(onChoose).toHaveBeenCalledWith('calm');
    expect(onUnpick).not.toHaveBeenCalled();
  });

  it('without an effect, says no line and a tap on the chosen tile chooses it again', async () => {
    const { onChoose, onUnpick } = await show(['energetic', 'joyful', 'calm'], {
      state: 'chosen',
      mood: mood('joyful'),
      effect: undefined,
    });

    expect(screen.queryByTestId('dashboard-mood-effect')).toBeNull();
    await fireEvent.press(screen.getByTestId('dashboard-mood-joyful'));

    expect(onChoose).toHaveBeenCalledWith('joyful');
    expect(onUnpick).not.toHaveBeenCalled();
  });
});
