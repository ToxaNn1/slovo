import { describe, expect, it, jest } from '@jest/globals';
import type { CuratedCollectionCard } from '@slovo/core';
import {
  CategoriesRail,
  coreTokens,
  CuratedCollectionsRail,
  EditionProvider,
  TokensProvider,
} from '@slovo/ui';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { testStrings } from '../test-strings';

const strings = testStrings({
  dashboard: {
    curatedCollectionsTitle: 'SLOVO suggests',
    curatedCollectionCount: { one: '{count} word', other: '{count} words' },
    curatedCollectionNew: 'New',
    curatedCollection: { added: 'Added ✓' },
    categories: { title: 'Categories' },
  },
});

function card(
  id: string,
  change: Partial<Omit<CuratedCollectionCard, 'collection'>> = {},
): CuratedCollectionCard {
  return {
    collection: {
      id,
      name: `Name ${id}`,
      description: `About ${id}`,
      publishedOn: '2026-11-01',
      entryIds: ['w_one', 'w_two', 'w_three'],
    },
    pictogram: { of: 'category', categoryId: 'feelings', position: 1 },
    state: 'new',
    added: false,
    ...change,
  };
}

async function renderIn(element: ReactElement) {
  await render(
    <TokensProvider tokens={coreTokens} colorScheme="light">
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        {element}
      </EditionProvider>
    </TokensProvider>,
  );
}

/** The path of every wedge drawn inside the element. */
function wedgesIn(testID: string): unknown[] {
  type Node = { props: Record<string, unknown>; children: readonly (Node | string)[] };
  const pointsIn = (node: Node | string): unknown[] =>
    typeof node === 'string'
      ? []
      : [
          ...('d' in node.props ? [node.props['d']] : []),
          ...node.children.flatMap(pointsIn),
        ];
  return pointsIn(screen.getByTestId(testID) as unknown as Node);
}

describe('CuratedCollectionsRail', () => {
  it('heads the rail with its title and the count of every collection published by today', async () => {
    await renderIn(
      <CuratedCollectionsRail cards={[card('cc_a')]} published={12} onOpen={() => undefined} />,
    );

    expect(screen.getByTestId('dashboard-curated-collections-title')).toHaveTextContent(
      /SLOVO suggests.*12/,
    );
  });

  it('shows each tile with its name and Entry count, «New» until opened, «Added ✓» once copied', async () => {
    await renderIn(
      <CuratedCollectionsRail
        cards={[
          card('cc_new'),
          card('cc_opened', { state: 'opened' }),
          card('cc_added', { state: 'opened', added: true }),
        ]}
        published={3}
        onOpen={() => undefined}
      />,
    );

    const tile = (id: string) => within(screen.getByTestId(`dashboard-curated-collection-${id}`));
    expect(tile('cc_new').getByText('Name cc_new')).toBeTruthy();
    expect(tile('cc_new').getByText('3 words')).toBeTruthy();
    expect(tile('cc_new').getByText('New')).toBeTruthy();
    expect(tile('cc_opened').queryByText('New')).toBeNull();
    expect(tile('cc_opened').queryByText('Added ✓')).toBeNull();
    expect(tile('cc_added').getByText('Added ✓')).toBeTruthy();
    expect(screen.getByTestId('dashboard-curated-collection-cc_new')).toHaveProp(
      'accessibilityLabel',
      'New. Name cc_new. 3 words',
    );
  });

  it("draws the pictogram of the Category it names, as that Category's own tile does", async () => {
    await renderIn(
      <>
        <CuratedCollectionsRail cards={[card('cc_a')]} published={1} onOpen={() => undefined} />
        <CategoriesRail
          tiles={[
            { id: 'nature', name: 'Nature' },
            { id: 'feelings', name: 'Feelings' },
          ]}
          onOpenAll={() => undefined}
          onOpen={() => undefined}
        />
      </>,
    );

    const drawn = wedgesIn('dashboard-curated-collection-cc_a');
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn).toEqual(wedgesIn('dashboard-category-feelings'));
    expect(drawn).not.toEqual(wedgesIn('dashboard-category-nature'));
  });

  it('opens the collection of the tapped tile', async () => {
    const onOpen = jest.fn();
    await renderIn(
      <CuratedCollectionsRail cards={[card('cc_a'), card('cc_b')]} published={2} onOpen={onOpen} />,
    );

    await fireEvent.press(screen.getByTestId('dashboard-curated-collection-cc_b'));

    expect(onOpen).toHaveBeenCalledWith('cc_b');
  });
});
