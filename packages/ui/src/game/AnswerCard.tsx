import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { useEdition } from '../providers/EditionProvider';
import { Button } from '../primitives/Button';
import { capitalMarkRoom, roundLayout, space, type TypeRole, typeStyle } from '../tokens';
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
      <VerdictTitle testID="game-answer-card-title" typeRole="answerVerdict" text={verdict} />
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
      <NextButton label={card.next} right={right} onPress={onNext} />
    </View>
  );
}

/** The verdict over an answered Round, the heading of the sheet after the answer. */
export function VerdictTitle({
  testID,
  typeRole,
  text,
}: {
  testID: string;
  typeRole: Extract<TypeRole, 'answerVerdict' | 'roundVerdict'>;
  text: string;
}) {
  const tokens = useTokens();
  const { voice } = useEdition();
  return (
    <Text
      testID={testID}
      accessibilityRole="header"
      maxFontSizeMultiplier={roundLayout.textMaxFontScale}
      {...voice}
      style={[
        typeStyle(typeRole, tokens),
        // The board's banner title sits clear of the slant over the sheet, not on its low edge.
        { marginTop: space[3] - capitalMarkRoom(typeRole), color: tokens.colors.ink },
      ]}
    >
      {text}
    </Text>
  );
}

/** «Далі →» under an answered Round, on the accent for a right answer, on the ink for a wrong one. */
export function NextButton({
  label,
  right,
  onPress,
}: {
  label: string;
  right: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.next}>
      <Button
        testID="game-next"
        label={label}
        variant={right ? 'onAccent' : 'primary'}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: roundLayout.sheetGap, paddingHorizontal: space[1], paddingBottom: space[2] },
  next: { marginTop: roundLayout.tightGap },
});
