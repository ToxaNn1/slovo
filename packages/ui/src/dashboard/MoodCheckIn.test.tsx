import type { Mood } from '@slovo/contracts';
import type { MoodBlock } from '@slovo/core';
import { EditionProvider, MoodCheckIn, UndoToastProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, within } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({ dashboard: { mood: { question: 'How are you?', note: 'Mood' } } });

function mood(id: string): Mood {
  return { id, name: id, emoji: '·', reply: `${id}!`, rarityBand: 'whole', shifts: {} };
}

async function show(ids: readonly string[]) {
  const block: MoodBlock = { kind: 'mood', moods: ids.map(mood), check: { state: 'asking' } };
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <UndoToastProvider>
        <MoodCheckIn block={block} onChoose={jest.fn()} />
      </UndoToastProvider>
    </EditionProvider>,
  );
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

  it('sets a name on its own line box, so it centres on its mark as on the board', async () => {
    await show(['energetic']);

    const name = screen.getByText('energetic');
    expect(name).toHaveStyle({ fontSize: 15 });
    // A line height under the font's own drops the glyphs below the mark on iOS.
    expect(name).not.toHaveStyle({ lineHeight: 15 });
  });
});
