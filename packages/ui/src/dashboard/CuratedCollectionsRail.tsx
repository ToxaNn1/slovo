import type { CuratedCollectionCard } from '@slovo/core';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressedTile } from '../primitives/PressedTile';
import { SectionLabel } from '../primitives/headings';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { railTileWidth, space, typeStyle } from '../tokens';

/**
 * The Curated Collections rail of the Dashboard (ADR 0076): «Добірки» over a
 * horizontal row of cards, one per collection published by today, each its
 * name and description, with «Нова» on one not opened yet. A card opens it.
 */
export function CuratedCollectionsRail({
  cards,
  onOpen,
}: {
  cards: readonly CuratedCollectionCard[];
  onOpen: (collectionId: string) => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const { curatedCollectionsTitle, curatedCollectionNew } = strings.dashboard;
  return (
    <>
      <SectionLabel>{curatedCollectionsTitle}</SectionLabel>
      <ScrollView
        testID="dashboard-curated-collections"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {cards.map(({ collection: { id, name, description }, state }) => {
          const isNew = state === 'new';
          return (
            <PressedTile
              key={id}
              testID={`dashboard-curated-collection-${id}`}
              accessibilityLabel={isNew ? `${curatedCollectionNew}. ${name}` : name}
              accessibilityLanguage={voice.accessibilityLanguage}
              onPress={() => {
                onOpen(id);
              }}
              faceStyle={styles.face}
            >
              {isNew ? (
                <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                  <Text
                    {...voice}
                    testID={`dashboard-curated-collection-${id}-new`}
                    style={[typeStyle('labelChip', tokens), { color: colors.background }]}
                  >
                    {curatedCollectionNew}
                  </Text>
                </View>
              ) : null}
              <Text {...voice} style={[typeStyle('rowLabel', tokens), { color: colors.ink }]}>
                {name}
              </Text>
              <Text
                {...voice}
                numberOfLines={3}
                style={[typeStyle('meta', tokens), { color: colors.muted }]}
              >
                {description}
              </Text>
            </PressedTile>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  rail: { gap: space[3], paddingBottom: space[2] },
  face: { width: railTileWidth, padding: space[4], gap: space[1] },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: space[2],
    paddingVertical: space[1] / 2,
    borderRadius: space[2],
    marginBottom: space[1],
  },
});
