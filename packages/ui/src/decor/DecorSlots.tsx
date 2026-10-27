'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import type { DecorMotif } from '@slovo/contracts';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useDecor } from './DecorProvider';
import { DecorView, MotifImage, MotifLayerImage, MotifPattern } from './Motif';
import { space, type ShareCardFormat } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { useReduceMotionKnown } from '../providers/useReduceMotion';

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

/**
 * Where each corner sits, `inset` points inside the card's edge, and how the
 * top-left corner is mirrored into it.
 */
const cornerPlacements = (inset: number) =>
  ({
    topLeft: { top: inset, left: inset },
    topRight: { top: inset, right: inset, transform: [{ scaleX: -1 }] },
    bottomLeft: { bottom: inset, left: inset, transform: [{ scaleY: -1 }] },
    bottomRight: { bottom: inset, right: inset, transform: [{ scaleX: -1 }, { scaleY: -1 }] },
  }) as const;

/** A corner of a card. */
type Corner = keyof ReturnType<typeof cornerPlacements>;

const allCorners: readonly Corner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

/** The top-left `corner` mirrored into the corners `at`, `scale` times its size, `inset` in. */
function MirroredCorners({
  corner,
  at,
  scale,
  inset,
}: {
  corner: DecorMotif;
  at: readonly Corner[];
  scale: number;
  inset: number;
}) {
  const placements = cornerPlacements(inset);
  return (
    <DecorView style={StyleSheet.absoluteFill}>
      {at.map((place) => (
        <View
          key={place}
          testID={`card-corner-${place}`}
          style={[styles.corner, placements[place]]}
        >
          <MotifImage motif={corner} width={corner.width * scale} />
        </View>
      ))}
    </DecorView>
  );
}

/**
 * Decor slot 3, the card frame: the Edition's corner in the corners of a
 * card, all four on a Word card and a Correction card, and fewer on other
 * cards as their design has it. Place it inside the card. Nothing when the Decor has no corners.
 */
export function CardCorners({ corners: at = allCorners }: { corners?: readonly Corner[] }) {
  const { corners } = useDecor();
  if (corners === undefined) return null;
  return <MirroredCorners corner={corners.corner} at={at} scale={1} inset={CORNER_INSET} />;
}

/**
 * Decor slot 5, the Share Card frame, `scale` times its size for a card drawn
 * larger or smaller than the design: the band across the Story card `inset`
 * points inside its top edge and, mirrored, its bottom edge, or the corner
 * mirrored into the four corners of the Square card, `inset` points in. Place
 * it inside the card. Nothing when the Decor has no Share Card frame, so the
 * card stays plain.
 */
export function ShareCardFrame({
  format,
  scale,
  inset,
}: {
  format: ShareCardFormat;
  scale: number;
  inset: number;
}) {
  const { shareCard } = useDecor();
  if (shareCard === undefined) return null;
  if (format === 'square') {
    return (
      <MirroredCorners corner={shareCard.corner} at={allCorners} scale={scale} inset={inset} />
    );
  }
  const bandHeight = { height: shareCard.band.height * scale };
  return (
    <DecorView style={StyleSheet.absoluteFill}>
      <View style={[styles.frameBand, bandHeight, { top: inset }]}>
        <MotifPattern motif={shareCard.band} scale={scale} />
      </View>
      <View style={[styles.frameBand, bandHeight, styles.mirrored, { bottom: inset }]}>
        <MotifPattern motif={shareCard.band} scale={scale} />
      </View>
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
const fadeEasing = Easing.inOut(Easing.ease);
/** The share of its size a stitch grows from. */
const STITCH_FROM_SCALE = 0.6;
/** The share of a stitch's motion in which it fades in. */
const STITCH_FADE_SHARE = 0.3;

/**
 * How a layer of the victory illustration arrives: `'stitch'` for the spring,
 * `'fade'` for Reduce Motion's fade, `'none'` for a layer drawn whole, and
 * `undefined` until the system has said whether Reduce Motion is on.
 */
type StitchMotion = 'stitch' | 'fade' | 'none' | undefined;

function stitchMotion(stitched: boolean, reduceMotion: boolean | undefined): StitchMotion {
  if (!stitched) return 'none';
  if (reduceMotion === undefined) return undefined;
  return reduceMotion ? 'fade' : 'stitch';
}

/** One layer of the victory illustration, starting `index` stitches late. */
function StitchedLayer({
  index,
  motion,
  children,
}: {
  index: number;
  motion: StitchMotion;
  children: ReactNode;
}) {
  const progress = useSharedValue(motion === 'none' ? 1 : 0);

  useEffect(() => {
    // Waits for the system's answer, so Reduce Motion never starts the full motion.
    if (motion === undefined) return;
    if (motion === 'none') {
      progress.value = 1;
      return;
    }
    // Assigning 0 first stops a stitch still running, so a new one starts from rest.
    progress.value = 0;
    progress.value =
      motion === 'fade'
        ? withTiming(1, { duration: FADE_MS, easing: fadeEasing, reduceMotion: ReduceMotion.Never })
        : withDelay(
            index * STITCH_GAP_MS,
            withTiming(1, {
              duration: STITCH_MS,
              easing: stitchEasing,
              reduceMotion: ReduceMotion.Never,
            }),
          );
  }, [progress, motion, index]);

  const reduced = motion === 'fade';
  const stitchStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, reduced ? 1 : STITCH_FADE_SHARE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: reduced
      ? []
      : [{ scale: interpolate(progress.value, [0, 1], [STITCH_FROM_SCALE, 1]) }],
  }));

  return <Animated.View style={[StyleSheet.absoluteFill, stitchStyle]}>{children}</Animated.View>;
}

/**
 * Decor slot 6, the victory illustration of the result screen, `width` points
 * wide. With `stitched` its layers come in one after another, 120 ms apart,
 * each springing to size; with Reduce Motion they fade in together. Without
 * it the illustration is drawn whole. Nothing when the Decor has none.
 */
export function VictoryIllustration({ width, stitched }: { width: number; stitched: boolean }) {
  const { victory } = useDecor();
  const reduceMotion = useReduceMotionKnown();
  if (victory === undefined) return null;
  const { illustration } = victory;
  const motion = stitchMotion(stitched, reduceMotion);
  return (
    <DecorView style={{ width, height: (width * illustration.height) / illustration.width }}>
      {illustration.layers.map((layer, index) => (
        <StitchedLayer key={index} index={index} motion={motion}>
          <MotifLayerImage motif={illustration} layer={layer} width={width} />
        </StitchedLayer>
      ))}
    </DecorView>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: 'row', alignItems: 'center' },
  band: { flex: 1, minWidth: 0, overflow: 'hidden' },
  corner: { position: 'absolute' },
  frameBand: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  mirrored: { transform: [{ scaleY: -1 }] },
});
