import { useEffect, useMemo } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useDecor } from './DecorProvider';
import { DecorView, MotifImage, MotifLayerImage, MotifPattern } from './Motif';
import { space } from './tokens';
import { useTokens } from './TokensProvider';
import { useReduceMotionKnown } from './useReduceMotion';

/**
 * Decor slot 1, the screen background: the Edition's tile repeated behind a
 * screen's content, `scale` times its size for a view drawn larger than the
 * screen. Place it first inside the screen; it fills the screen. Plain when
 * the Decor has no background.
 */
export function DecorBackground({ scale = 1 }: { scale?: number }) {
  const { background } = useDecor();
  if (background === undefined) return null;
  return (
    <DecorView style={StyleSheet.absoluteFill}>
      <MotifPattern motif={background.tile} scale={scale} />
    </DecorView>
  );
}

/** The size of the arrow a Correction card's divider has in its centre. */
const ARROW_SIZE = 18;

/**
 * Decor slot 2, the ornament divider: the band on both sides of the centre,
 * `scale` times its size for a view drawn larger or smaller than the screen.
 * A Correction card asks for an arrow in the centre instead ("this becomes
 * that"), drawn in the accent colour.
 */
export function OrnamentDivider({
  centre = 'ornament',
  scale = 1,
}: {
  centre?: 'ornament' | 'arrow';
  scale?: number;
}) {
  const { divider } = useDecor();
  const { colors } = useTokens();
  const band = (
    <View style={[styles.band, { height: divider.band.height * scale }]}>
      <MotifPattern motif={divider.band} scale={scale} />
    </View>
  );
  return (
    <DecorView style={[styles.divider, { gap: space[2] * scale }]}>
      {band}
      {centre === 'arrow' ? (
        <Svg width={ARROW_SIZE * scale} height={ARROW_SIZE * scale} viewBox="0 0 24 24">
          <Path d="M12 5v14M6 13l6 6 6-6" fill="none" stroke={colors.accent} strokeWidth={2} />
        </Svg>
      ) : (
        <MotifImage motif={divider.centre} width={divider.centre.width * scale} />
      )}
      {band}
    </DecorView>
  );
}

/**
 * Decor slot 2's band alone, across the whole width, as the design uses it
 * on the Favorites card, sheets and widgets.
 */
export function OrnamentBand() {
  const { divider } = useDecor();
  return (
    <DecorView style={[styles.band, { height: divider.band.height }]}>
      <MotifPattern motif={divider.band} />
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

/** A corner of a card. */
type Corner = keyof typeof cornerPlacements;

const allCorners: readonly Corner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

/**
 * Decor slot 3, the card frame: the Edition's corner in the corners of a
 * card, all four on a Word card, and fewer on other cards as their design has
 * it. Place it inside the card. Nothing when the Decor has no corners.
 */
export function CardCorners({ corners: at = allCorners }: { corners?: readonly Corner[] }) {
  const { corners } = useDecor();
  if (corners === undefined) return null;
  return (
    <DecorView style={StyleSheet.absoluteFill}>
      {at.map((corner) => (
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

/** The design's win motion: each stitch starts 120 ms after the one before. */
const STITCH_GAP_MS = 120;
/** One stitch takes the design's 500 ms spring, eased like its `cubic-bezier(.3, 1.6, .5, 1)`. */
const STITCH_MS = 500;
const stitchEasing = Easing.bezier(0.3, 1.6, 0.5, 1);
/** What Reduce Motion does in place of the stitching: a fade. */
const FADE_MS = 250;
/** The share of its size a stitch grows from. */
const STITCH_FROM_SCALE = 0.6;

/**
 * Decor slot 6, the victory illustration of the result screen, `width` points
 * wide. With `stitched` its layers come in one after another, 120 ms apart,
 * each springing to size; with Reduce Motion they fade in together. Without
 * it the illustration is drawn whole. Nothing when the Decor has none.
 */
export function VictoryIllustration({ width, stitched }: { width: number; stitched: boolean }) {
  const { victory } = useDecor();
  const motion = useReduceMotionKnown();
  const reduceMotion = motion === true;
  const layers = victory?.illustration.layers;
  const progress = useMemo(
    () => (layers ?? []).map(() => new Animated.Value(stitched ? 0 : 1)),
    [layers, stitched],
  );

  useEffect(() => {
    // Waits for the system's answer, so Reduce Motion never starts the full motion.
    if (!stitched || motion === undefined) return;
    const animation = Animated.parallel(
      progress.map((value, index) => {
        value.setValue(0);
        return reduceMotion
          ? Animated.timing(value, { toValue: 1, duration: FADE_MS, useNativeDriver: true })
          : Animated.timing(value, {
              toValue: 1,
              duration: STITCH_MS,
              delay: index * STITCH_GAP_MS,
              easing: stitchEasing,
              useNativeDriver: true,
            });
      }),
    );
    animation.start();
    return () => {
      animation.stop();
    };
  }, [progress, motion, reduceMotion, stitched]);

  if (victory === undefined) return null;
  const { illustration } = victory;
  return (
    <DecorView style={{ width, height: (width * illustration.height) / illustration.width }}>
      {illustration.layers.map((layer, index) => {
        const value = progress[index];
        return (
          <Animated.View
            key={index}
            style={[
              StyleSheet.absoluteFill,
              value !== undefined && {
                opacity: value.interpolate({
                  inputRange: [0, reduceMotion ? 1 : 0.3],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
                transform: reduceMotion
                  ? []
                  : [
                      {
                        scale: value.interpolate({
                          inputRange: [0, 1],
                          outputRange: [STITCH_FROM_SCALE, 1],
                        }),
                      },
                    ],
              },
            ]}
          >
            <MotifLayerImage motif={illustration} layer={layer} width={width} />
          </Animated.View>
        );
      })}
    </DecorView>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: 'row', alignItems: 'center' },
  band: { flex: 1, minWidth: 0, overflow: 'hidden' },
  corner: { position: 'absolute' },
});
