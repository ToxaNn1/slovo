import { fill, type CorrectionType } from '@slovo/contracts';
import type { CorrectionTypeTile } from '@slovo/core';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { PressedTile } from '../primitives/PressedTile';
import { SectionLabel } from '../primitives/headings';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { railTileWidth, space, typeStyle } from '../tokens';

/**
 * The Correction Types rail of the Dashboard (ADR 0076): «Виправлення» over a
 * horizontal row of tiles, one per Correction Type with live Corrections, each
 * its type's name and «Розібрано X з N». A tile opens its type's screen.
 */
export function CorrectionTypesRail({
  tiles,
  onOpen,
}: {
  tiles: readonly CorrectionTypeTile[];
  onOpen: (type: CorrectionType) => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const words = strings.dashboard.correctionTypes;
  return (
    <>
      <SectionLabel>{words.title}</SectionLabel>
      <ScrollView
        testID="dashboard-correction-types"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {tiles.map(({ type, total, workedThrough }) => {
          const count = fill(words.workedThrough, { x: String(workedThrough), n: String(total) });
          return (
            <PressedTile
              key={type}
              testID={`dashboard-correction-type-${type}`}
              accessibilityLabel={`${words.tiles[type]}, ${count}`}
              accessibilityLanguage={voice.accessibilityLanguage}
              onPress={() => {
                onOpen(type);
              }}
              faceStyle={styles.face}
            >
              <Text {...voice} style={[typeStyle('rowLabel', tokens), { color: colors.ink }]}>
                {words.tiles[type]}
              </Text>
              <Text {...voice} style={[typeStyle('meta', tokens), { color: colors.muted }]}>
                {count}
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
});
