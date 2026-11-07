import { StyleSheet, Text, View } from 'react-native';
import { useEdition } from '../providers/EditionProvider';
import { Button } from '../primitives/Button';
import { roundLayout, space, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/**
 * The inline answer card under a Round's options (board 07, spec #1674):
 * «Влучно!» on the accent for a right answer or «Майже. Наступне вийде.» in
 * ink for a wrong one, one line of explanation, the Definition or the
 * Correction's explanation, and «Далі →». It covers nothing of the Round;
 * the Example and its author live in the expanded Game Review rows.
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
  return (
    <View testID="game-answer-card" style={styles.card}>
      <Text
        testID="game-answer-card-title"
        accessibilityRole="header"
        maxFontSizeMultiplier={roundLayout.textMaxFontScale}
        {...voice}
        style={[typeStyle('roundVerdict', tokens), { color: right ? colors.accent : colors.ink }]}
      >
        {right ? card.right : card.wrong}
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
        <Button testID="game-next" label={card.next} variant="primary" onPress={onNext} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: roundLayout.sheetGap, paddingTop: space[2] },
  next: { marginTop: roundLayout.tightGap },
});
