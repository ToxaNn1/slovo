import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useDecor } from './DecorProvider';
import { DecorView, MotifImage, MotifPattern } from './Motif';
import { space } from './tokens';
import { useTokens } from './TokensProvider';

/**
 * Decor slot 1, the screen background: the Edition's tile repeated behind a
 * screen's content. Place it first inside the screen; it fills the screen.
 * Plain when the Decor has no background.
 */
export function DecorBackground() {
  const { background } = useDecor();
  if (background === undefined) return null;
  return (
    <DecorView style={StyleSheet.absoluteFill}>
      <MotifPattern motif={background.tile} />
    </DecorView>
  );
}

/** The size of the arrow a Correction card's divider has in its centre. */
const ARROW_SIZE = 18;

/**
 * Decor slot 2, the ornament divider: the band on both sides of the centre.
 * A Correction card asks for an arrow in the centre instead ("this becomes
 * that"), drawn in the accent colour.
 */
export function OrnamentDivider({ centre = 'ornament' }: { centre?: 'ornament' | 'arrow' }) {
  const { divider } = useDecor();
  const { colors } = useTokens();
  const band = (
    <View style={[styles.band, { height: divider.band.height }]}>
      <MotifPattern motif={divider.band} />
    </View>
  );
  return (
    <DecorView style={styles.divider}>
      {band}
      {centre === 'arrow' ? (
        <Svg width={ARROW_SIZE} height={ARROW_SIZE} viewBox="0 0 24 24">
          <Path d="M12 5v14M6 13l6 6 6-6" fill="none" stroke={colors.accent} strokeWidth={2} />
        </Svg>
      ) : (
        <MotifImage motif={divider.centre} width={divider.centre.width} />
      )}
      {band}
    </DecorView>
  );
}

/** How far the corners sit inside the card's edge. */
const CORNER_INSET = space[2];

const cornerPlacements = {
  topLeft: { top: CORNER_INSET, left: CORNER_INSET },
  topRight: { top: CORNER_INSET, right: CORNER_INSET, transform: [{ scaleX: -1 }] },
  bottomLeft: { bottom: CORNER_INSET, left: CORNER_INSET, transform: [{ scaleY: -1 }] },
  bottomRight: {
    bottom: CORNER_INSET,
    right: CORNER_INSET,
    transform: [{ scaleX: -1 }, { scaleY: -1 }],
  },
} as const;

/**
 * Decor slot 3, the card frame: the Edition's corner in the card's corners,
 * all four on the Word card and the top two on other cards. Place it inside
 * the card. Nothing when the Decor has no corners.
 */
export function CardCorners({ placement = 'all' }: { placement?: 'all' | 'top' }) {
  const { corners } = useDecor();
  if (corners === undefined) return null;
  const shown =
    placement === 'all'
      ? (['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const)
      : (['topLeft', 'topRight'] as const);
  return (
    <DecorView style={StyleSheet.absoluteFill}>
      {shown.map((corner) => (
        <View key={corner} style={[styles.corner, cornerPlacements[corner]]}>
          <MotifImage motif={corners.corner} width={corners.corner.width} />
        </View>
      ))}
    </DecorView>
  );
}

/**
 * Decor slot 4, the empty-state illustration (end of Cycle, empty lists),
 * or with `kind="error"` the one for an error state, `width` points wide.
 * Nothing when the Decor has none.
 */
export function EmptyStateIllustration({
  kind = 'empty',
  width,
}: {
  kind?: 'empty' | 'error';
  width: number;
}) {
  const { emptyState } = useDecor();
  const motif = kind === 'error' ? emptyState?.error : emptyState?.illustration;
  if (motif === undefined) return null;
  return (
    <DecorView>
      <MotifImage motif={motif} width={width} />
    </DecorView>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  band: { flex: 1, minWidth: 0, overflow: 'hidden' },
  corner: { position: 'absolute' },
});
