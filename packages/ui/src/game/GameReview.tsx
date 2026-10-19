import type { PlayedRound } from '@slovo/core';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { stressLabel } from '../entries/stress-label';
import { fill, useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { minTouchTarget, rowPadding, space, typeSize } from '../tokens';

/** How far the largest text sizes of iOS may scale the rows' text, so it never breaks a word. */
const TEXT_MAX_FONT_SCALE = 1.5;

/** What a row leads with: the Word asked about, or the Correction's non-standard form. */
function titleOf({ entry, answer }: PlayedRound) {
  return entry.kind === 'word'
    ? answer.sheet.answer
    : { text: entry.nonStandardForm, stressedVowels: [] as readonly string[] };
}

/**
 * The Game Review under the result: every Round of the Game just over, in
 * order, with ✓ or ✗ and the reader's wrong pick. A tap expands a Round: a
 * Word's Definition, Example and etymology, or a Correction's right form and
 * explanation; a second tap opens the Entry. One Round is expanded at a time.
 * Nothing is drawn while `shown` is false, which is while the gameReview
 * Feature Switch is off in effect (ADR 0040).
 */
export function GameReview({
  shown,
  rounds,
  onOpen,
}: {
  shown: boolean;
  /** The Rounds played, in order. */
  rounds: readonly PlayedRound[];
  /** Opens the Entry a Round asked about. */
  onOpen: (entryId: string) => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
  const [expanded, setExpanded] = useState<number>();
  if (!shown) return null;
  return (
    <View testID="game-review" style={styles.review}>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        {...voice}
        style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.ui }]}
      >
        {strings.game.review.title}
      </Text>
      {rounds.map((round) => (
        <ReviewRow
          key={round.number}
          round={round}
          expanded={expanded === round.number}
          onPress={() => {
            if (expanded === round.number) onOpen(round.entry.id);
            else setExpanded(round.number);
          }}
        />
      ))}
    </View>
  );
}

function ReviewRow({
  round,
  expanded,
  onPress,
}: {
  round: PlayedRound;
  expanded: boolean;
  onPress: () => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
  const { review } = strings.game;
  const title = titleOf(round);
  const picked = round.right
    ? undefined
    : fill(review.picked, { text: round.options[round.answer.chosen]?.text ?? '' });
  const label = [
    String(round.number),
    stressLabel(strings.wordCard, title.text, title.stressedVowels),
    round.right ? review.right : review.wrong,
    ...(picked === undefined ? [] : [picked]),
  ].join(', ');
  return (
    <View style={[styles.row, { borderColor: colors.line }]}>
      <Pressable
        testID={`game-review-row-${String(round.number)}`}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={expanded ? review.openHint : review.expandHint}
        accessibilityState={{ expanded }}
        {...voice}
        onPress={onPress}
        style={styles.head}
      >
        <Text
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[styles.number, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {round.number}
        </Text>
        <View style={styles.text}>
          <Text
            maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
            style={[styles.lemma, { color: colors.ink, fontFamily: fontFamilies.word }]}
          >
            {title.text}
          </Text>
          {picked === undefined ? null : (
            <Text
              maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
              style={[styles.picked, { color: colors.wrong, fontFamily: fontFamilies.ui }]}
            >
              {picked}
            </Text>
          )}
        </View>
        <Text
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[
            styles.mark,
            { color: round.right ? colors.correct : colors.wrong, fontFamily: fontFamilies.ui },
          ]}
        >
          {round.right ? '✓' : '✗'}
        </Text>
      </Pressable>
      {expanded ? <ReviewDetails round={round} /> : null}
    </View>
  );
}

/** What an expanded Round shows of its Entry. */
function ReviewDetails({ round: { entry, answer } }: { round: PlayedRound }) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
  const body = [styles.body, { color: colors.ink, fontFamily: fontFamilies.word }];
  const heading = [styles.heading, { color: colors.muted, fontFamily: fontFamilies.ui }];
  if (entry.kind === 'correction') {
    return (
      <View testID="game-review-details" {...voice} style={styles.details}>
        <Text maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE} style={heading}>
          {strings.correctionCard.standard}
        </Text>
        <Text maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE} style={[body, styles.form]}>
          {answer.sheet.answer.text}
        </Text>
        <Text maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE} style={body}>
          {entry.explanation}
        </Text>
      </View>
    );
  }
  const example = entry.examples[0];
  return (
    <View testID="game-review-details" {...voice} style={styles.details}>
      <Text maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE} style={body}>
        {entry.primaryDefinition}
      </Text>
      {example === undefined ? null : (
        <View>
          <Text
            maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
            style={[body, styles.example, { color: colors.inkSecondary }]}
          >
            {fill(strings.wordCard.example, { text: example.text })}
          </Text>
          {example.author === undefined ? null : (
            <Text
              maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
              style={[styles.author, { color: colors.muted, fontFamily: fontFamilies.ui }]}
            >
              {fill(strings.wordCard.exampleAuthor, { author: example.author })}
            </Text>
          )}
        </View>
      )}
      {entry.etymology === undefined ? null : (
        <View>
          <Text maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE} style={heading}>
            {strings.wordCard.etymology}
          </Text>
          <Text maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE} style={body}>
            {entry.etymology}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  review: { alignSelf: 'stretch', marginTop: space[4] },
  title: { fontSize: typeSize.blockHeading, fontWeight: '700', marginBottom: space[2] },
  row: { borderTopWidth: StyleSheet.hairlineWidth },
  head: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: rowPadding,
  },
  number: { minWidth: space[5], fontSize: typeSize.meta, fontWeight: '700' },
  text: { flex: 1, gap: space[1] },
  lemma: { fontSize: typeSize.listItem, fontWeight: '500' },
  picked: { fontSize: typeSize.caption, fontWeight: '500' },
  mark: { fontSize: typeSize.blockHeading, fontWeight: '700' },
  details: { gap: space[3], paddingBottom: rowPadding, paddingLeft: space[5] + space[3] },
  heading: { fontSize: typeSize.meta, fontWeight: '700' },
  body: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.5 },
  form: { fontWeight: '500' },
  example: { fontStyle: 'italic' },
  author: { marginTop: space[1], fontSize: typeSize.meta, fontWeight: '500' },
});
