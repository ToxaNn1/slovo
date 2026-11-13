import { StyleSheet, Text, View } from 'react-native';

import { Mascot } from '../primitives/Mascot';
import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { quietScreen as place, space, typeStyle } from '../tokens';
import { HeroBack, useHeroRoom } from './HeroBack';

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
  const { shift, height, onLayout } = useHeroRoom(place.height);
  return (
    <View
      testID={id}
      style={[
        styles.hero,
        { minHeight: place.height + shift, paddingTop: place.padding.top + shift },
      ]}
      onLayout={onLayout}
    >
      <Wedge
        points={place.cut}
        color={colors.surfaceSunken}
        width="100%"
        height={height}
        style={StyleSheet.absoluteFill}
      />
      <HeroBack
        id={id}
        back={back}
        place={place.back}
        shift={shift}
        tile={colors.background}
        ink={colors.ink}
      />
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
  title: { maxWidth: place.titleWidth },
  description: { maxWidth: place.descriptionWidth },
  mascot: {
    position: 'absolute',
    right: place.mascot.right - space[4],
    bottom: place.mascot.bottom - space[4],
  },
});
