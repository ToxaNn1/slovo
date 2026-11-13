import type { CorrectionType } from '@slovo/contracts';
import type { CorrectionTypeTile } from '@slovo/core';
import { ScrollView, StyleSheet } from 'react-native';

import { PressedTile } from '../primitives/PressedTile';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { correctionTile, dashboard, typeStyle } from '../tokens';
import { RailHeader } from './RailHeader';

/**
 * The Correction Types rail of the Dashboard (ADR 0076): «Виправлення» with
 * the count of tiles over a horizontal row that runs to the screen's edges,
 * one tile per Correction Type with live Corrections, each its type's name
 * under a red glyph, drawn small enough to fit the tile whole, never split. A tile opens its type's screen. Given `categories`, the
 * header reads their number instead and is a button that opens the grid of
 * the Categories of Corrections, k2 (spec #1604); without, a plain title.
 */
export function CorrectionTypesRail({
  tiles,
  categories,
  onOpen,
}: {
  tiles: readonly CorrectionTypeTile[];
  /** The Categories of Corrections' number and the opener of their grid. */
  categories?: { readonly count: number; readonly onOpenAll: () => void } | undefined;
  onOpen: (type: CorrectionType) => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const words = strings.dashboard.correctionTypes;
  return (
    <>
      <RailHeader
        testID="dashboard-correction-types-title"
        title={words.title}
        note={String(categories?.count ?? tiles.length)}
        onPress={categories?.onOpenAll}
      />
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
              <WholeWordsText
                {...voice}
                testID={`dashboard-correction-type-${type}-name`}
                text={words.tiles[type]}
                typeRole="correctionName"
                style={[typeStyle('correctionName', tokens), { color: colors.ink }]}
              />
            </PressedTile>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
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
