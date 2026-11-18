import { buildGameReview, stressLabel, type PlayedRound } from '@slovo/core';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { fontScaleCap, minTouchTarget, reviewMark, space, typeStyle } from '../tokens';

/**
 * The Game Review under the result, «Огляд раундів» (spec #1880, D11; ADR 0139): every Round of the
 * Game just over, in order, as the Core's rows, a red ✓ or an ink ✗ and
 * the word. A row neither expands nor opens the Entry; VoiceOver reads its
 * number, its word and whether it was right.
 */
export function GameReview({ rounds }: { rounds: readonly PlayedRound[] }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const { review } = strings.game;
  const rows = useMemo(() => buildGameReview(rounds), [rounds]);
  return (
    <View testID="game-review" style={styles.review}>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={fontScaleCap.text}
        {...voice}
        style={[typeStyle('reviewTitle', tokens), styles.title, { color: colors.ink }]}
      >
        {strings.game.finals.review}
      </Text>
      {rows.map(({ number, right, word }) => (
        <View
          key={number}
          testID={`game-review-row-${String(number)}`}
          accessible
          accessibilityLabel={[
            String(number),
            stressLabel(strings.wordCard, word.text, word.stressedVowels),
            right ? review.right : review.wrong,
          ].join(', ')}
          {...voice}
          style={[styles.row, styles.head, { borderColor: colors.line }]}
        >
          <ReviewMark number={number} right={right} />
          <Text
            maxFontSizeMultiplier={fontScaleCap.text}
            style={[typeStyle('reviewWord', tokens), styles.text, { color: colors.ink }]}
          >
            {word.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The red ✓ of a right Round or the ink ✗ of a wrong one. */
function ReviewMark({ number, right }: { number: number; right: boolean }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const keyInk = useSchemeColors('light').ink;
  return (
    <View
      testID={`game-review-mark-${String(number)}`}
      style={[styles.mark, { backgroundColor: right ? colors.accent : colors.ink }]}
    >
      <Text
        maxFontSizeMultiplier={fontScaleCap.text}
        style={[typeStyle('reviewMark', tokens), { color: right ? keyInk : colors.background }]}
      >
        {right ? '✓' : '✗'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  review: { alignSelf: 'stretch', marginTop: space[4] },
  title: { marginBottom: space[1] },
  row: { borderBottomWidth: StyleSheet.hairlineWidth },
  head: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
  },
  text: { flex: 1, gap: space[1] },
  mark: {
    width: reviewMark.side,
    height: reviewMark.side,
    borderRadius: reviewMark.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
