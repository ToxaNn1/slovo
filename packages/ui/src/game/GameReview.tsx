import { buildGameReview, stressLabel, type GameReviewItem, type PlayedRound } from '@slovo/core';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { minTouchTarget, reviewMark, rowPadding, space, typeStyle } from '../tokens';

/** How far the largest text sizes of iOS may scale the rows' text, so it never breaks a word. */
const TEXT_MAX_FONT_SCALE = 1.5;

/**
 * The Game Review under the result: every Round of the Game just over, in
 * order, as the Core's Game Review items, led by a red ✓ or an ink ✗ and, on a mistake, the
 * reader's answer in the Round's form: the option picked, the form stressed on
 * the vowel tapped, the Definition matched to a pair's Word, the chips tapped
 * as one Word or expression, or the text typed, which reads «Ви ввели» where a
 * pick reads «Ваш вибір». A Round of «Звідки слово» leads with the Word, its
 * right language beside it. VoiceOver reads a stressed
 * answer without its marks, then where the Stress falls. A tap expands a
 * Round: a Word's or an idiom's Definition, Example and etymology, a
 * Correction's right form and explanation, a Synonym Row's members, or a Tip's
 * explanation; a second tap opens the Entry. One Round is expanded at a time.
 */
export function GameReview({
  rounds,
  onOpen,
}: {
  /** The Rounds played, in order. */
  rounds: readonly PlayedRound[];
  /** Opens the Entry a Round asked about. */
  onOpen: (entryId: string) => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const items = useMemo(() => buildGameReview(rounds), [rounds]);
  const [expanded, setExpanded] = useState<number>();
  return (
    <View testID="game-review" style={styles.review}>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        {...voice}
        style={[typeStyle('reviewTitle', tokens), styles.title, { color: colors.ink }]}
      >
        {strings.game.review.title}
      </Text>
      {items.map((item) => (
        <ReviewRow
          key={item.number}
          item={item}
          expanded={expanded === item.number}
          onPress={() => {
            if (expanded === item.number) onOpen(item.entryId);
            else setExpanded(item.number);
          }}
        />
      ))}
    </View>
  );
}

function ReviewRow({
  item: { number, title, answer, right, picked: pickedOption, details },
  expanded,
  onPress,
}: {
  item: GameReviewItem;
  expanded: boolean;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const { review } = strings.game;
  const keyInk = useSchemeColors('light').ink;
  const pickedTemplate = pickedOption?.form === 'typed' ? review.typed : review.picked;
  const picked =
    pickedOption === undefined ? undefined : fill(pickedTemplate, { text: pickedOption.text });
  const withAnswer = (text: string) =>
    answer === undefined ? text : fill(review.withAnswer, { title: text, answer: answer.text });
  const label = [
    String(number),
    withAnswer(stressLabel(strings.wordCard, title.text, title.stressedVowels)),
    right ? review.right : review.wrong,
    ...(pickedOption === undefined
      ? []
      : [
          fill(pickedTemplate, {
            text: stressLabel(strings.wordCard, pickedOption.text, pickedOption.stressedVowels),
          }),
        ]),
  ].join(', ');
  return (
    <View style={[styles.row, { borderColor: colors.line }]}>
      <Pressable
        testID={`game-review-row-${String(number)}`}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={expanded ? review.openHint : review.expandHint}
        accessibilityState={{ expanded }}
        {...voice}
        onPress={onPress}
        style={styles.head}
      >
        <View
          testID={`game-review-mark-${String(number)}`}
          style={[styles.mark, { backgroundColor: right ? colors.accent : colors.ink }]}
        >
          <Text
            maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
            style={[typeStyle('reviewMark', tokens), { color: right ? keyInk : colors.background }]}
          >
            {right ? '✓' : '✗'}
          </Text>
        </View>
        <View style={styles.text}>
          <Text
            maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
            style={[typeStyle('reviewWord', tokens), { color: colors.ink }]}
          >
            {withAnswer(title.text)}
          </Text>
          {picked === undefined ? null : (
            <Text
              maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
              style={[typeStyle('reviewPicked', tokens), { color: colors.wrong }]}
            >
              {picked}
            </Text>
          )}
        </View>
      </Pressable>
      {expanded ? <ReviewDetails details={details} /> : null}
    </View>
  );
}

/** What an expanded Round shows of its Entry. */
function ReviewDetails({ details }: { details: GameReviewItem['details'] }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const body = [typeStyle('reviewText', tokens), { color: colors.ink }];
  const heading = [typeStyle('reviewHeading', tokens), { color: colors.muted }];
  if (details.kind === 'correction') {
    return (
      <View testID="game-review-details" {...voice} style={styles.details}>
        <Text maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE} style={heading}>
          {strings.correctionCard.standard}
        </Text>
        <Text
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[typeStyle('reviewForm', tokens), { color: colors.ink }]}
        >
          {details.standardForm}
        </Text>
        <Text maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE} style={body}>
          {details.explanation}
        </Text>
      </View>
    );
  }
  if (details.kind === 'tip') {
    return (
      <View testID="game-review-details" {...voice} style={styles.details}>
        <Text maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE} style={body}>
          {details.explanation}
        </Text>
      </View>
    );
  }
  if (details.kind === 'synonymRow') {
    return (
      <View testID="game-review-details" {...voice} style={styles.details}>
        <Text maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE} style={body}>
          {details.members.map(({ text }) => text).join(', ')}
        </Text>
      </View>
    );
  }
  const { definition, example, etymology } = details;
  return (
    <View testID="game-review-details" {...voice} style={styles.details}>
      <Text maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE} style={body}>
        {definition}
      </Text>
      {example === undefined ? null : (
        <View>
          <Text
            maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
            style={[body, styles.example, { color: colors.ink }]}
          >
            {fill(strings.wordCard.example, { text: example.text })}
          </Text>
          {example.author === undefined ? null : (
            <Text
              maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
              style={[typeStyle('meta', tokens), styles.author, { color: colors.muted }]}
            >
              {fill(strings.wordCard.exampleAuthor, { author: example.author })}
            </Text>
          )}
        </View>
      )}
      {etymology === undefined ? null : (
        <View>
          <Text maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE} style={heading}>
            {details.kind === 'idiom' ? strings.idiomCard.etymology : strings.wordCard.etymology}
          </Text>
          <Text maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE} style={body}>
            {etymology}
          </Text>
        </View>
      )}
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
  details: { gap: space[3], paddingBottom: rowPadding, paddingLeft: reviewMark.side + space[3] },
  example: { fontStyle: 'italic' },
  author: { marginTop: space[1] },
});
