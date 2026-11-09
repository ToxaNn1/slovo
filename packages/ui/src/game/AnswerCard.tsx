import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { useEdition } from '../providers/EditionProvider';
import { Button } from '../primitives/Button';
import { capitalMarkRoom, roundLayout, space, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/**
 * The answer card the sheet after an answer shows (board 07, spec #1674),
 * on the accent for a right answer, «Влучно!», or on the ink for a wrong one,
 * «Майже. Наступне вийде.»: the verdict, one line of explanation, the
 * Definition or the Correction's explanation, and «Далі →». It takes the
 * colours of the sheet it is on. The Example and its author live in the
 * expanded Game Review rows. VoiceOver hears the verdict and the line as the
 * card shows.
 */
export function AnswerCard({
  right,
  line,
  onNext,
}: {
  right: boolean;
  /** The explanation line; none when the Entry has nothing to explain. */
  line: string | undefined;
  onNext: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const card = strings.game.round.answerCard;
  const verdict = right ? card.right : card.wrong;
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(line === undefined ? verdict : `${verdict} ${line}`);
  }, [verdict, line]);
  return (
    <View testID="game-answer-card" style={styles.card}>
      <Text
        testID="game-answer-card-title"
        accessibilityRole="header"
        maxFontSizeMultiplier={roundLayout.textMaxFontScale}
        {...voice}
        style={[typeStyle('answerVerdict', tokens), styles.verdict, { color: colors.ink }]}
      >
        {verdict}
      </Text>
      {line === undefined ? null : (
        <Text
          testID="game-answer-card-line"
          maxFontSizeMultiplier={roundLayout.textMaxFontScale}
          {...voice}
          style={[typeStyle('roundExplanation', tokens), { color: colors.ink }]}
        >
          {line}
        </Text>
      )}
      <View style={styles.next}>
        <Button
          testID="game-next"
          label={card.next}
          variant={right ? 'onAccent' : 'primary'}
          onPress={onNext}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: roundLayout.sheetGap, paddingHorizontal: space[1], paddingBottom: space[2] },
  // The board's banner title sits clear of the slant over the sheet, not on its low edge.
  verdict: { marginTop: space[3] - capitalMarkRoom('answerVerdict') },
  next: { marginTop: roundLayout.tightGap },
});
