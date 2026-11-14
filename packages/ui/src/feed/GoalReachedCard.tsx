import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { goalReachedCard as card, typeStyle } from '../tokens';
import { HalftoneGround } from '../primitives/HalftoneGround';
import { Mascot } from '../primitives/Mascot';
import { useTurnToNextPage } from '../primitives/VerticalPager';

/** The most Word plates the card shows before «+ ще …» takes the last place. */
const PLATES = 3;

/**
 * «Ціль дня виконано!» (ADR 0128): the red card of the day's Daily Goal met,
 * its plate with the goal, the first Words Seen today, the celebrating
 * Mascot and the Streak, or no Streak while the reader doesn't see it. The
 * button turns to the next card as a swipe would, and so closes the card.
 * It keeps the design's colours in both schemes, as the design draws it.
 */
export function GoalReachedCard({
  goal,
  words,
  streak,
}: {
  /** The Words Seen the day's Daily Goal asked for. */
  goal: number;
  /** The Lemmas of the first Words Seen today, in the order Seen. */
  words: readonly string[];
  /** The Streak, or undefined while the reader doesn't see it. */
  streak: number | undefined;
}) {
  const { strings, count, voice } = useEdition();
  const tokens = useTokens();
  const { accentEdge, background: cream, ink } = useSchemeColors('light');
  const {
    label,
    plate,
    title,
    message,
    collected,
    more,
    streak: streakLabel,
    next,
  } = strings.feedNotices.goalReached;
  const turnToNext = useTurnToNextPage();
  const [size, setSize] = useState<{ width: number; height: number }>();
  const plates =
    goal <= PLATES
      ? words.slice(0, goal).map((word) => ({ text: word, word: true }))
      : [
          ...words.slice(0, PLATES - 1).map((word) => ({ text: word, word: true })),
          { text: count(more, goal - (PLATES - 1)), word: false },
        ];
  return (
    <View
      testID="goal-reached"
      style={styles.card}
      onLayout={({ nativeEvent: { layout } }) => {
        setSize({ width: layout.width, height: layout.height });
      }}
    >
      {size !== undefined && (
        <HalftoneGround id="goal-reached" width={size.width} height={size.height} />
      )}
      <View style={[styles.band, { backgroundColor: accentEdge }]} />
      <View style={styles.top}>
        <Text style={[typeStyle('goalReachedLabel', tokens), { color: ink }]}>{label}</Text>
        <View style={[styles.plate, { backgroundColor: ink }]}>
          <Text style={[typeStyle('goalReachedPlate', tokens), { color: cream }]}>
            {count(plate, goal)}
          </Text>
        </View>
      </View>
      <Text
        accessibilityRole="header"
        style={[typeStyle('goalReachedTitle', tokens), styles.title, { color: ink }]}
      >
        {title}
      </Text>
      <Text style={[typeStyle('goalReachedText', tokens), styles.text, { color: ink }]}>
        {message}
      </Text>
      {plates.length > 0 && (
        <View style={styles.words}>
          <Text style={[typeStyle('goalReachedCaption', tokens), { color: ink }]}>{collected}</Text>
          {plates.map(({ text, word }, index) => {
            const last = index === plates.length - 1;
            return (
              <View
                key={text}
                style={[
                  styles.word,
                  {
                    marginLeft: card.word.steps[index],
                    transform: [{ rotate: card.word.turns[index] ?? '0deg' }],
                    backgroundColor: last ? ink : cream,
                  },
                ]}
              >
                <Text
                  {...(word ? voice : {})}
                  style={[typeStyle('goalReachedWord', tokens), { color: last ? cream : ink }]}
                >
                  {text}
                </Text>
              </View>
            );
          })}
        </View>
      )}
      <View style={styles.fill} />
      <View style={styles.foot}>
        <Mascot state="celebrates" onRed width={card.mascot} />
        {streak !== undefined && (
          <View testID="goal-reached-streak" style={styles.streak}>
            <View style={styles.streakNumber}>
              <Svg
                width={card.flame.width}
                height={card.flame.height}
                viewBox="0 0 20 26"
                accessible={false}
              >
                <Path
                  d="M10 0c1 5 7 8 7 15a7 7 0 0 1-14 0c0-4 2-6 4-8 0 3 1 4 3 5-1-4 0-8 0-12z"
                  fill={cream}
                />
              </Svg>
              <Text style={[typeStyle('goalReachedStreak', tokens), { color: cream }]}>
                {streak}
              </Text>
            </View>
            <Text style={[typeStyle('goalReachedCaption', tokens), styles.right, { color: cream }]}>
              {count(streakLabel, streak)}
            </Text>
          </View>
        )}
      </View>
      <Pressable
        testID="goal-reached-next"
        accessibilityRole="button"
        accessibilityLabel={next}
        onPress={() => turnToNext?.()}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: ink,
            boxShadow: [
              {
                offsetX: 0,
                offsetY: pressed ? 1 : card.button.shadow,
                blurRadius: 0,
                color: card.button.shadowColor,
              },
            ],
            transform: [{ translateY: pressed ? card.button.shadow - 1 : 0 }],
          },
        ]}
      >
        <Text style={[typeStyle('goalReachedButton', tokens), { color: cream }]}>{next}</Text>
        <Svg
          width={card.button.arrow.width}
          height={card.button.arrow.height}
          viewBox="0 0 14 18"
          accessible={false}
        >
          <Polygon points="7,0 14,7 10,7 10,18 4,18 4,7 0,7" fill={cream} />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignSelf: 'stretch',
    marginTop: card.margin.top,
    marginBottom: card.margin.bottom,
    marginHorizontal: card.margin.horizontal,
    borderRadius: card.radius,
    overflow: 'hidden',
    paddingTop: card.padding.top,
    paddingHorizontal: card.padding.horizontal,
    paddingBottom: card.padding.bottom,
  },
  band: {
    position: 'absolute',
    left: -card.band.outside,
    right: -card.band.outside,
    bottom: -card.band.below,
    height: card.band.height,
    transformOrigin: 'left top',
    transform: [{ rotate: card.band.turn }],
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  plate: {
    paddingVertical: card.plate.padding.vertical,
    paddingHorizontal: card.plate.padding.horizontal,
    transform: [{ skewX: card.plate.skew }],
  },
  title: { marginTop: card.titleGap },
  text: { marginTop: card.textGap, maxWidth: card.textWidth },
  words: { marginTop: card.wordsGap, alignItems: 'flex-start', gap: card.wordGap },
  word: {
    paddingVertical: card.word.padding.vertical,
    paddingHorizontal: card.word.padding.horizontal,
    boxShadow: [
      { offsetX: 0, offsetY: card.word.shadow, blurRadius: 0, color: card.word.shadowColor },
    ],
  },
  fill: { flex: 1 },
  foot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: card.footGap,
  },
  streak: { alignItems: 'flex-end', gap: card.streakGap, marginBottom: card.streakGap },
  streakNumber: { flexDirection: 'row', alignItems: 'center', gap: card.flame.gap },
  right: { textAlign: 'right' },
  button: {
    marginTop: card.buttonGap,
    height: card.button.height,
    borderRadius: card.button.radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: card.button.gap,
  },
});
