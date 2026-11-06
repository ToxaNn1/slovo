import type { CuratedCollectionCard } from '@slovo/core';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressedTile } from '../primitives/PressedTile';
import { TileShape } from '../primitives/TileShape';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { categoryTile, dashboard, typeStyle } from '../tokens';
import { BlockTitle } from './BlockTitle';

/**
 * The Curated Collections rail of the Dashboard (ADR 0076, 0081): «Добірки»
 * with the count of cards over a horizontal row of tiles that runs to the
 * screen's edges, one per collection published by today. A tile shows its
 * name under a two-shape pictogram, on red, ink or the sunken surface in turn,
 * and opens its screen. Its count of Entries, «Нова» on one not opened yet and
 * «Додано ✓» on one copied are not on board 05 and stay commented out with
 * the DESIGN-05 marker till the owner decides.
 */
export function CuratedCollectionsRail({
  cards,
  onOpen,
}: {
  cards: readonly CuratedCollectionCard[];
  onOpen: (collectionId: string) => void;
}) {
  const { strings } = useEdition();
  return (
    <>
      <View style={styles.title}>
        <BlockTitle
          title={strings.dashboard.curatedCollectionsTitle}
          note={String(cards.length)}
          testID="dashboard-curated-collections-title"
        />
      </View>
      <ScrollView
        testID="dashboard-curated-collections"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {cards.map((card, index) => (
          <CategoryTile
            key={card.collection.id}
            card={card}
            index={index}
            onPress={() => {
              onOpen(card.collection.id);
            }}
          />
        ))}
      </ScrollView>
    </>
  );
}

function CategoryTile({
  card: {
    collection: { id, name, entryIds },
    // DESIGN-05: not on the board, owner decides
    // state,
    // added,
  },
  index,
  onPress,
}: {
  card: CuratedCollectionCard;
  index: number;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const light = useSchemeColors('light');
  const { strings, voice, count } = useEdition();
  // DESIGN-05: not on the board, owner decides
  // const { curatedCollectionNew, curatedCollection } = strings.dashboard;
  const { curatedCollectionCount } = strings.dashboard;
  // The board's three tones in turn: red, ink, the sunken surface.
  const tone = [
    { ground: colors.accent, text: light.ink, big: light.ink, small: light.background },
    { ground: colors.ink, text: colors.background, big: colors.accent, small: colors.background },
    { ground: colors.surfaceSunken, text: colors.ink, big: colors.accent, small: colors.ink },
  ][index % 3];
  const [big, small] = categoryTile.shapes[index % categoryTile.shapes.length] ?? [];
  // DESIGN-05: not on the board, owner decides
  // const isNew = state === 'new';
  const entries = count(curatedCollectionCount, entryIds.length);
  if (tone === undefined || big === undefined || small === undefined) return null;
  return (
    <PressedTile
      testID={`dashboard-curated-collection-${id}`}
      tone="none"
      radius={categoryTile.radius}
      accessibilityLabel={[
        // DESIGN-05: not on the board, owner decides
        // isNew ? curatedCollectionNew : '',
        name,
        entries,
        // DESIGN-05: not on the board, owner decides
        // added ? curatedCollection.added : '',
      ]
        .filter((part) => part !== '')
        .join('. ')}
      accessibilityLanguage={voice.accessibilityLanguage}
      onPress={onPress}
      faceStyle={[styles.face, { backgroundColor: tone.ground }]}
    >
      <TileShape shape={big} color={tone.big} place={categoryTile.big} />
      <TileShape shape={small} color={tone.small} place={categoryTile.small} />
      {
        // DESIGN-05: not on the board, owner decides
        // {isNew ? (
        //   <Text
        //     {...voice}
        //     testID={`dashboard-curated-collection-${id}-new`}
        //     style={[styles.mark, typeStyle('labelChip', tokens), { color: tone.text }]}
        //   >
        //     {curatedCollectionNew}
        //   </Text>
        // ) : added ? (
        //   <Text
        //     {...voice}
        //     testID={`dashboard-curated-collection-${id}-added`}
        //     style={[styles.mark, typeStyle('labelChip', tokens), { color: tone.text }]}
        //   >
        //     {curatedCollection.added}
        //   </Text>
        // ) : null}
      }
      <Text {...voice} style={[typeStyle('categoryName', tokens), { color: tone.text }]}>
        {name}
      </Text>
      {
        // DESIGN-05: not on the board, owner decides
        // <Text {...voice} style={[styles.count, typeStyle('categoryCount', tokens), { color: tone.text }]}>{entries}</Text>
      }
    </PressedTile>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: dashboard.side, paddingBottom: dashboard.titleGap },
  rail: {
    gap: categoryTile.gap,
    paddingHorizontal: dashboard.side,
    paddingBottom: dashboard.railBottom,
  },
  face: {
    width: categoryTile.width,
    height: categoryTile.height,
    padding: categoryTile.padding,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  mark: { position: 'absolute', left: categoryTile.padding, top: categoryTile.padding },
  count: { marginTop: categoryTile.countGap, opacity: categoryTile.countOpacity },
});
