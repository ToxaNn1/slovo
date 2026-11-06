import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../primitives/Icon';
import { Mascot } from '../primitives/Mascot';
import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { pressedFade, quietScreen as place, railScreen, space, typeStyle } from '../tokens';

/**
 * The hero of a quiet Category's screen (board 05.2 k3): the sunken surface
 * with no halftone, cut at the bottom as the loud hero is, the back tile on
 * the background, `label` («Категорія») over the Category's name and its
 * description in the muted ink, and the Mascot in its quiet hat-off state
 * (ADR 0070). It has no right button, no icon tile and no progress.
 */
export function QuietScreenHero({
  id,
  label,
  title,
  description,
  back,
}: {
  /** Unique on the screen: it names the test IDs. */
  id: string;
  label: string;
  title: string;
  description: string;
  back: { label: string; onPress: () => void; testID?: string };
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  // The board measures from the screen's top under its status bar.
  const shift = Math.max(0, useSafeAreaInsets().top - railScreen.statusBar);
  // The board's height, or more when a long name or description needs it.
  const [height, setHeight] = useState(place.height + shift);
  return (
    <View
      testID={id}
      style={[styles.hero, { minHeight: place.height + shift, paddingTop: place.padding.top + shift }]}
      onLayout={(event) => {
        setHeight(event.nativeEvent.layout.height);
      }}
    >
      <Wedge
        points={place.cut}
        color={colors.surfaceSunken}
        width="100%"
        height={height}
        style={StyleSheet.absoluteFill}
      />
      <Pressable
        testID={back.testID ?? `${id}-back`}
        accessibilityRole="button"
        accessibilityLabel={back.label}
        {...voice}
        onPress={back.onPress}
        style={({ pressed }) => [
          styles.back,
          { top: place.back.top + shift, backgroundColor: colors.background },
          pressed && styles.pressed,
        ]}
      >
        <Icon name="back" size={place.back.icon} color={colors.ink} />
      </Pressable>
      <Text
        {...voice}
        testID={`${id}-label`}
        style={[typeStyle('quietLabel', tokens), { color: colors.muted }]}
      >
        {label}
      </Text>
      <Text
        {...voice}
        accessibilityRole="header"
        style={[typeStyle('quietTitle', tokens), styles.title, { color: colors.ink }]}
      >
        {title}
      </Text>
      <Text
        {...voice}
        testID={`${id}-description`}
        style={[typeStyle('quietDescription', tokens), styles.description, { color: colors.muted }]}
      >
        {description}
      </Text>
      {/* The Mascot pads its figure by `space[4]`; the board places the figure itself. */}
      <View style={styles.mascot}>
        <Mascot state="hatOff" width={place.mascot.width} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: place.padding.side, gap: place.gap },
  back: {
    position: 'absolute',
    left: place.back.left,
    width: place.back.side,
    height: place.back.side,
    borderRadius: place.back.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: pressedFade },
  title: { maxWidth: place.titleWidth },
  description: { maxWidth: place.descriptionWidth },
  mascot: {
    position: 'absolute',
    right: place.mascot.right - space[4],
    bottom: place.mascot.bottom - space[4],
  },
});
