import type { CorrectionType } from '@slovo/contracts';
import { StyleSheet } from 'react-native';

import { PressedTile } from '../primitives/PressedTile';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { correctionTile, typeStyle } from '../tokens';

/**
 * One Correction Type's tile: its name under a red glyph, the
 * glyph by the tile's place, on the sunken surface, the name drawn small
 * enough to fit whole, never split. The rail gives it its `width`; in a grid
 * it fills its column. It opens its type.
 */
export function CorrectionTypeTile({
  type,
  index,
  width,
  testID,
  onOpen,
}: {
  type: CorrectionType;
  /** The tile's place, which picks its glyph. */
  index: number;
  /** The face's width; the column's whole width unless given. */
  width?: number;
  testID: string;
  onOpen: (type: CorrectionType) => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const name = strings.dashboard.correctionTypes.tiles[type];
  const glyph = correctionTile.glyphs[index % correctionTile.glyphs.length];
  return (
    <PressedTile
      testID={testID}
      tone="none"
      radius={correctionTile.radius}
      accessibilityLabel={name}
      accessibilityLanguage={voice.accessibilityLanguage}
      onPress={() => {
        onOpen(type);
      }}
      faceStyle={[styles.face, { width, backgroundColor: colors.surfaceSunken }]}
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
        testID={`${testID}-name`}
        text={name}
        typeRole="correctionName"
        style={[typeStyle('correctionName', tokens), { color: colors.ink }]}
      />
    </PressedTile>
  );
}

const styles = StyleSheet.create({
  face: {
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
