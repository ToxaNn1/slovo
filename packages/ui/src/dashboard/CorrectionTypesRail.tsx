import type { CorrectionType } from '@slovo/contracts';
import type { CorrectionTypeTile } from '@slovo/core';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressedTile } from '../primitives/PressedTile';
import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { correctionTile, dashboard, typeStyle } from '../tokens';
import { BlockTitle } from './BlockTitle';

/**
 * The Correction Types rail of the Dashboard (ADR 0076): «Виправлення» with
 * the count of tiles over a horizontal row that runs to the screen's edges,
 * one tile per Correction Type with live Corrections, each its type's name
 * under a red glyph. A tile opens its type's screen.
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
      <View style={styles.title}>
        <BlockTitle
          title={words.title}
          note={String(tiles.length)}
          testID="dashboard-correction-types-title"
        />
      </View>
      <ScrollView
        testID="dashboard-correction-types"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {tiles.map(({ type }, index) => {
          const glyph = correctionTile.glyphs[index % correctionTile.glyphs.length];
          return (
            <PressedTile
              key={type}
              testID={`dashboard-correction-type-${type}`}
              tone="none"
              radius={correctionTile.radius}
              accessibilityLabel={words.tiles[type]}
              accessibilityLanguage={voice.accessibilityLanguage}
              onPress={() => {
                onOpen(type);
              }}
              faceStyle={[styles.face, { backgroundColor: colors.surfaceSunken }]}
            >
              {glyph !== undefined && (
                <Wedge
                  points={glyph}
                  color={colors.accent}
                  width={correctionTile.glyph.side}
                  height={correctionTile.glyph.side}
                  style={styles.glyph}
                />
              )}
              <Text {...voice} style={[typeStyle('correctionName', tokens), { color: colors.ink }]}>
                {words.tiles[type]}
              </Text>
            </PressedTile>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: dashboard.side, paddingBottom: dashboard.titleGap },
  rail: {
    gap: correctionTile.gap,
    paddingHorizontal: dashboard.side,
    paddingBottom: dashboard.railBottom,
  },
  face: {
    width: correctionTile.width,
    height: correctionTile.height,
    padding: correctionTile.padding,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  glyph: {
    position: 'absolute',
    right: correctionTile.glyph.right,
    top: correctionTile.glyph.top,
  },
});
