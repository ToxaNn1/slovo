import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { Mascot } from '../primitives/Mascot';
import { usePageTurnActions } from '../primitives/VerticalPager';
import { Wedge } from '../primitives/Wedge';
import { endOfCycleCard, typeStyle, wedges } from '../tokens';

/**
 * The end-of-Cycle card: the waiting Mascot over a title and one line of
 * muted text, centred on the Feed's background before a large ∞, with two
 * chevrons under them that point down to swipe on: it says the reader has
 * Seen every live Entry and asks them to wait for new ones or swipe on to
 * start a new Cycle. It has no surface of its own. VoiceOver reads it as
 * one element.
 */
export function EndOfCycleCard() {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const { title, message } = strings.endOfCycle;
  // In the Feed, VoiceOver turns to the card that starts the new Cycle from here.
  const turnActions = usePageTurnActions();
  const { width, height } = endOfCycleCard.chevrons;
  return (
    <View
      testID="end-of-cycle-card"
      accessible
      accessibilityLabel={`${title}. ${message}`}
      {...voice}
      {...turnActions}
      style={styles.card}
    >
      <Text
        style={[
          typeStyle('endOfCycleInfinity', tokens),
          styles.infinity,
          { color: colors.surfaceSunken },
        ]}
      >
        ∞
      </Text>
      <Mascot state="waits" />
      <Text style={[typeStyle('endOfCycleTitle', tokens), styles.text, { color: colors.ink }]}>
        {title}
      </Text>
      <Text style={[typeStyle('stepText', tokens), styles.text, { color: colors.muted }]}>
        {message}
      </Text>
      <View style={{ width, height }}>
        <Wedge points={wedges.swipeOn} color={colors.accent} width={width} height={height} />
        <Wedge
          points={wedges.swipeOnLower}
          color={colors.muted}
          width={width}
          height={height}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: endOfCycleCard.gap,
  },
  infinity: {
    position: 'absolute',
    left: endOfCycleCard.infinity.left,
    top: endOfCycleCard.infinity.top,
  },
  text: { textAlign: 'center' },
});
