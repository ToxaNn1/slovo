import type { CuratedCollectionCard } from '@slovo/core';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressedTile } from '../primitives/PressedTile';
import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { categoryTile, dashboard, typeStyle } from '../tokens';
import { BlockTitle } from './BlockTitle';

type Pictogram = (typeof categoryTile.shapes)[number][number];

/**
 * The Curated Collections rail of the Dashboard (ADR 0076): «Категорії» with
 * the count of cards over a horizontal row of tiles that runs to the screen's
 * edges, one per collection published by today. A tile shows its name and
 * its count of Entries under a two-shape pictogram, on red, ink or the sunken
 * surface in turn, with «Нова» on one not opened yet and «Додано ✓» on one
 * copied into the reader's Collections. A tile opens its screen.
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
    state,
    added,
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
  const { curatedCollectionNew, curatedCollection, curatedCollectionCount } = strings.dashboard;
  // The board's three tones in turn: red, ink, the sunken surface.
  const tone = [
    { ground: colors.accent, text: light.ink, big: light.ink, small: light.background },
    { ground: colors.ink, text: colors.background, big: colors.accent, small: colors.background },
    { ground: colors.surfaceSunken, text: colors.ink, big: colors.accent, small: colors.ink },
  ][index % 3];
  const [big, small] = categoryTile.shapes[index % categoryTile.shapes.length] ?? [];
  const isNew = state === 'new';
  const entries = count(curatedCollectionCount, entryIds.length);
  if (tone === undefined || big === undefined || small === undefined) return null;
  return (
    <PressedTile
      testID={`dashboard-curated-collection-${id}`}
      tone="none"
      radius={categoryTile.radius}
      accessibilityLabel={[
        isNew ? curatedCollectionNew : '',
        name,
        entries,
        added ? curatedCollection.added : '',
      ]
        .filter((part) => part !== '')
        .join('. ')}
      accessibilityLanguage={voice.accessibilityLanguage}
      onPress={onPress}
      faceStyle={[styles.face, { backgroundColor: tone.ground }]}
    >
      <Shape shape={big} color={tone.big} place={categoryTile.big} />
      <Shape shape={small} color={tone.small} place={categoryTile.small} />
      {isNew ? (
        <Text
          {...voice}
          testID={`dashboard-curated-collection-${id}-new`}
          style={[styles.mark, typeStyle('labelChip', tokens), { color: tone.text }]}
        >
          {curatedCollectionNew}
        </Text>
      ) : added ? (
        <Text
          {...voice}
          testID={`dashboard-curated-collection-${id}-added`}
          style={[styles.mark, typeStyle('labelChip', tokens), { color: tone.text }]}
        >
          {curatedCollection.added}
        </Text>
      ) : null}
      <Text {...voice} style={[typeStyle('categoryName', tokens), { color: tone.text }]}>
        {name}
      </Text>
      <Text
        {...voice}
        style={[styles.count, typeStyle('categoryCount', tokens), { color: tone.text }]}
      >
        {entries}
      </Text>
    </PressedTile>
  );
}

/** One shape of a tile's pictogram, a polygon or a circle, at its place. */
function Shape({
  shape,
  color,
  place: { side, right, top },
}: {
  shape: Pictogram;
  color: string;
  place: { side: number; right: number; top: number };
}) {
  const at = { position: 'absolute', right, top } as const;
  return shape === 'circle' ? (
    <View
      style={[at, { width: side, height: side, borderRadius: side / 2, backgroundColor: color }]}
    />
  ) : (
    <Wedge points={shape} color={color} width={side} height={side} style={at} />
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
