import { ActionRow, EditionProvider } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Text } from 'react-native';

import { testStrings } from '../test-strings';

function inEdition(element: ReactElement) {
  return render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      {element}
    </EditionProvider>,
  );
}

function row(share: boolean, marks?: boolean) {
  return (
    <ActionRow
      marks={marks === true ? <Text testID="marks">marks</Text> : undefined}
      favorite={<Text testID="favorite">♡</Text>}
      share={share ? <Text testID="share">share</Text> : undefined}
      collection={<Text testID="collection">+</Text>}
      hide={<Text testID="hide">×</Text>}
    />
  );
}

/** How many action slots the row draws. */
function slotCount(): number {
  const slots = screen.getByTestId('action-row-actions').children;
  return slots.length;
}

describe('ActionRow', () => {
  it('has a share button when it is given one', async () => {
    await inEdition(row(true));

    expect(screen.getByTestId('share')).toBeOnTheScreen();
    expect(screen.getByTestId('favorite')).toBeOnTheScreen();
    expect(slotCount()).toBe(4);
  });

  it('leaves the share slot out, and keeps the other three, without one', async () => {
    await inEdition(row(false));

    expect(screen.queryByTestId('share')).toBeNull();
    for (const id of ['favorite', 'collection', 'hide'])
      expect(screen.getByTestId(id)).toBeOnTheScreen();
    expect(slotCount()).toBe(3);
  });

  it('has the mark buttons when it is given them', async () => {
    await inEdition(row(true, true));

    expect(screen.getByTestId('marks')).toBeOnTheScreen();
  });

  it('has no mark buttons without them', async () => {
    await inEdition(row(true));

    expect(screen.queryByTestId('marks')).toBeNull();
  });

  it('draws only the actions it is given, as on a Synonym Row', async () => {
    await inEdition(
      <ActionRow
        look="icons"
        favorite={<Text testID="favorite">♡</Text>}
        collection={<Text testID="collection">+</Text>}
      />,
    );

    expect(slotCount()).toBe(2);
  });

  it('puts the report flag last when it is given one', async () => {
    await inEdition(
      <ActionRow
        favorite={<Text testID="favorite">♡</Text>}
        collection={<Text testID="collection">+</Text>}
        report={<Text testID="report">⚑</Text>}
      />,
    );

    expect(slotCount()).toBe(3);
    expect(screen.getByTestId('report')).toBeOnTheScreen();
  });

  it('shows the hint under the tiles, and none without one', async () => {
    const { rerender } = await inEdition(row(true));
    expect(screen.queryByTestId('action-row-hint')).toBeNull();

    await rerender(
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <ActionRow
          favorite={<Text testID="favorite">♡</Text>}
          collection={<Text testID="collection">+</Text>}
          hint="In «Autumn words» · in Favorites"
        />
      </EditionProvider>,
    );

    expect(screen.getByText('In «Autumn words» · in Favorites')).toBeOnTheScreen();
  });
});
