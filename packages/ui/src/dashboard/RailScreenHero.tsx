import type { MascotState } from '@slovo/contracts';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnAccentProvider } from '../entries/on-accent';
import { HalftoneGround } from '../primitives/HalftoneGround';
import { Icon } from '../primitives/Icon';
import { Mascot } from '../primitives/Mascot';
import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import {
  pressedFade,
  railScreen as place,
  space,
  typeStyle,
  withAlpha,
  type Wedge as WedgePoints,
} from '../tokens';

/**
 * The hero of a screen a Dashboard rail's tile opens (board `SlovoApp`,
 * «fix» and «cat»): the red halftone ground cut at the bottom, the ink back
 * tile, the ink icon tile with the tile's red glyph beside the kicker, the
 * title, the description, the progress label over its skewed bar, and the
 * Mascot. A Curated Collection's hero adds its add button at the top right.
 */
export function RailScreenHero({
  id,
  glyph,
  kicker,
  title,
  description,
  progress,
  done,
  mascot,
  back,
  add,
}: {
  /** Unique on the screen: it names the raster and the test IDs. */
  id: string;
  /** The tile's glyph on the icon tile: a polygon or a `circle`. */
  glyph: WedgePoints | 'circle';
  kicker: string;
  title: string;
  description: string;
  /** «Розібрано 0 з 4», drawn in capitals. */
  progress: string;
  /** How much of the bar is filled, from 0 to 1. */
  done: number;
  mascot: MascotState;
  back: { label: string; onPress: () => void; testID?: string };
  add?: { label: string; added: boolean; onPress: () => void; testID?: string };
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { ink: keyInk, background: cream } = useSchemeColors('light');
  const { voice } = useEdition();
  const { width } = useWindowDimensions();
  // The board measures from the screen's top under a 54-point status bar.
  const shift = Math.max(0, useSafeAreaInsets().top - place.statusBar);
  // The board's height, or more when a long title or description pushes the bar down.
  const [height, setHeight] = useState(place.height + shift);
  const text = (role: Parameters<typeof typeStyle>[0]) => [
    typeStyle(role, tokens),
    { color: keyInk },
  ];
  return (
    <View
      testID={id}
      style={{ minHeight: place.height + shift, paddingTop: place.column.top + shift }}
      onLayout={(event) => {
        setHeight(event.nativeEvent.layout.height);
      }}
    >
      <HalftoneGround id={id} width={width} height={height} points={place.cut} />
      <OnAccentProvider value>
        <Pressable
          testID={back.testID ?? `${id}-back`}
          accessibilityRole="button"
          accessibilityLabel={back.label}
          {...voice}
          onPress={back.onPress}
          style={({ pressed }) => [
            styles.back,
            { top: place.back.top + shift, backgroundColor: keyInk },
            pressed && styles.pressed,
          ]}
        >
          <Icon name="back" size={place.back.icon} color={cream} />
        </Pressable>
        {add !== undefined && (
          <Pressable
            testID={add.testID ?? `${id}-add`}
            accessibilityRole="button"
            accessibilityLabel={add.label}
            accessibilityState={{ selected: add.added }}
            {...voice}
            onPress={add.onPress}
            style={({ pressed }) => [
              styles.add,
              {
                top: place.add.top + shift,
                backgroundColor: add.added ? keyInk : cream,
                // The board's hard edge under the button not yet pressed.
                borderBottomWidth: add.added ? 0 : place.add.edge,
                borderBottomColor: withAlpha(keyInk, place.add.edgeAlpha),
              },
              pressed && styles.pressed,
            ]}
          >
            <Wedge
              points={add.added ? place.addIcons.tick : place.addIcons.plus}
              color={add.added ? cream : keyInk}
              width={place.add.icon}
              height={place.add.icon}
            />
            <Text
              {...voice}
              style={[typeStyle('railAdd', tokens), { color: add.added ? cream : keyInk }]}
            >
              {add.label}
            </Text>
          </Pressable>
        )}
        {/* The column and the bar flow: the bar keeps the board's place unless the column reaches it. */}
        <View style={styles.columnRoom}>
          <View style={styles.column}>
            <View style={styles.kickerRow}>
              <View style={[styles.icon, { backgroundColor: keyInk }]}>
                {glyph === 'circle' ? (
                  <View style={[styles.circle, { backgroundColor: colors.accent }]} />
                ) : (
                  <Wedge
                    points={glyph}
                    color={colors.accent}
                    width={place.icon.glyph}
                    height={place.icon.glyph}
                  />
                )}
              </View>
              <Text {...voice} testID={`${id}-kicker`} style={text('railKicker')}>
                {kicker}
              </Text>
            </View>
            <Text {...voice} accessibilityRole="header" style={text('railTitle')}>
              {title}
            </Text>
            <Text {...voice} style={[text('railDescription'), styles.description]}>
              {description}
            </Text>
          </View>
        </View>
        <View style={styles.progressRow}>
          <View style={styles.progress}>
            <Text {...voice} testID={`${id}-progress`} style={text('railProgress')}>
              {progress}
            </Text>
            <View
              style={[styles.bar, { backgroundColor: withAlpha(keyInk, place.progress.empty) }]}
            >
              {/* The filled part and the rest share the bar by flex: no percent string to build. */}
              <View style={{ flex: share(done), backgroundColor: keyInk }} />
              <View style={{ flex: 1 - share(done) }} />
            </View>
          </View>
          {/* The Mascot stands where the board has it beside the bar, and moves down with it. */}
          <View style={styles.mascot}>
            <Mascot state={mascot} onRed width={place.mascot.width} />
          </View>
        </View>
      </OnAccentProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    position: 'absolute',
    left: place.back.left,
    width: place.back.side,
    height: place.back.side,
    borderRadius: place.back.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    position: 'absolute',
    right: place.add.right,
    height: place.add.height,
    paddingHorizontal: place.add.paddingHorizontal,
    borderRadius: place.add.radius,
    flexDirection: 'row',
    alignItems: 'center',
    gap: place.add.gap,
  },
  pressed: { opacity: pressedFade },
  // From the column's top to the bar's on the board; a taller column grows it.
  columnRoom: { minHeight: place.progress.top - place.column.top },
  column: {
    marginLeft: place.column.left,
    marginRight: place.column.right,
    marginBottom: place.column.gap,
    gap: place.column.gap,
  },
  progressRow: { paddingBottom: place.bottom },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: place.column.kickerGap },
  icon: {
    width: place.icon.side,
    height: place.icon.side,
    borderRadius: place.icon.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: { width: place.icon.glyph, height: place.icon.glyph, borderRadius: place.icon.glyph / 2 },
  description: { maxWidth: place.column.descriptionWidth },
  progress: {
    marginLeft: place.progress.left,
    width: place.progress.width,
    gap: place.progress.gap,
  },
  bar: {
    flexDirection: 'row',
    height: place.progress.bar,
    transform: [{ skewX: place.progress.skew }],
  },
  // The Mascot pads its figure by `space[4]`; the board places the figure itself.
  mascot: {
    position: 'absolute',
    top: place.mascot.top - place.progress.top - space[4],
    right: place.mascot.right - space[4],
  },
});

/** How much of the bar is filled, clamped to 0 to 1. */
function share(done: number): number {
  return Math.min(1, Math.max(0, done));
}
