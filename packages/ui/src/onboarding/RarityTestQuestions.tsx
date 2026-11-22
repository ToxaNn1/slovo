import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { RARITIES, type Rarity } from '@slovo/contracts';

import { fill, useEdition } from '../providers/EditionProvider';
import { Button } from '../primitives/Button';
import { rarityRangeLabel } from '../settings/rarity-range-label';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { fontScaleCap, minTouchTarget, rarityTestLayout, space, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** A Word the Rarity Test asks about. */
export interface RarityTestQuestion {
  readonly rarity: Rarity;
  /** The Lemma with its Stress mark. */
  readonly lemma: string;
  /** What VoiceOver reads for the Lemma, which says where the Stress falls. */
  readonly accessibilityLabel: string;
}

/**
 * What the answers came to: the top of the Rarity Range they set, from the
 * lowest rarity, whether that changed the range, and how many of the Words
 * the reader knew.
 */
export interface RarityTestResult {
  readonly top: Rarity;
  readonly changed: boolean;
  readonly known: number;
  readonly total: number;
}

/** A screen of the Rarity Test, which its caller draws in its own frame. */
export interface RarityTestScreen {
  readonly testID: string;
  /** The screen's buttons, pinned under the content. */
  readonly footer: ReactNode;
  readonly children: ReactNode;
}

/** Where the Rarity Test is: the Word asked about, or the top of the Rarity Range it set. */
type RarityTestPhase =
  | { readonly kind: 'asking'; readonly answers: readonly { rarity: Rarity; known: boolean }[] }
  | { readonly kind: 'result'; readonly result: RarityTestResult };

/**
 * The Rarity Test's questions and result (board 11, screens 92–93), the same
 * in onboarding and from Settings: each Word in turn by its Lemma with Stress
 * under a bar of one segment per Word and «{n} з {total} · Чи знаєш ти це
 * слово?», with «Не знаю» and «Знаю» side by side; the last answer applies
 * them all. The result shows the Rarity Range set as a big number, the line
 * «Твоя рідкість — до {n}…», five bars lit up to it and how many Words the
 * reader knew; no range line. With `onAgain` (Settings) it closes
 * on «ГОТОВО» and offers the test again; without it (onboarding) one «Далі»
 * goes on. The caller draws each screen in its own frame.
 */
export function RarityTestQuestions({
  testID,
  words,
  onApply,
  onDone,
  onAgain,
  frame,
}: {
  /** The prefix of the screens' and buttons' testIDs. */
  testID: string;
  /** The Words to ask about, in the order asked. */
  words: readonly RarityTestQuestion[];
  /**
   * Applies the answers and resolves to the Rarity Range they set, or to
   * nothing when none was set; it never rejects.
   */
  onApply: (
    answers: readonly { rarity: Rarity; known: boolean }[],
  ) => Promise<RarityTestResult | undefined>;
  /** Goes on from the result, or at once when the answers set no ceiling. */
  onDone: () => void;
  /** Starts the test again from the result; only Settings offers it. */
  onAgain?: (() => void) | undefined;
  frame: (screen: RarityTestScreen) => ReactNode;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice, strings } = useEdition();
  const [phase, setPhase] = useState<RarityTestPhase>({ kind: 'asking', answers: [] });
  /** Whether the answers are applied, so a second tap on the last Word applies nothing. */
  const applied = useRef(false);
  /** The answers given so far, ahead of `phase` when two taps come before a redraw. */
  const given = useRef<readonly { rarity: Rarity; known: boolean }[]>([]);
  /** «3 з 10» over the Word asked about. */
  const progressOf = (asked: number) =>
    fill(strings.rarityTest.progress, { n: String(asked + 1), total: String(words.length) });
  // VoiceOver stays on the buttons, so it says where the test is and each next Word.
  const asked = phase.kind === 'asking' ? phase.answers.length : 0;
  const spoken = asked > 0 ? words[asked] : undefined;
  const announcement =
    spoken === undefined
      ? undefined
      : fill(strings.rarityTest.announcement, {
          n: String(asked + 1),
          total: String(words.length),
          word: spoken.accessibilityLabel,
        });
  useEffect(() => {
    if (announcement !== undefined) AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);

  const answer = (known: boolean) => {
    // Read from the ref, not the render: a second tap before the redraw answers the next Word.
    const word = words[given.current.length];
    if (word === undefined) return;
    const answers = [...given.current, { rarity: word.rarity, known }];
    given.current = answers;
    setPhase({ kind: 'asking', answers });
    if (answers.length < words.length || applied.current) return;
    applied.current = true;
    void onApply(answers).then((result) => {
      if (result === undefined) onDone();
      else setPhase({ kind: 'result', result });
    });
  };

  if (phase.kind === 'result') {
    return frame({
      testID: `${testID}-result`,
      footer:
        onAgain === undefined ? (
          <Button testID={`${testID}-next`} label={strings.rarityTest.next} onPress={onDone} />
        ) : (
          <>
            <Button
              testID={`${testID}-done`}
              variant="inverse"
              label={strings.rarityTest.done}
              onPress={onDone}
            />
            <QuietButton
              testID={`${testID}-again`}
              label={strings.rarityTest.again}
              onPress={onAgain}
            />
          </>
        ),
      children: <RarityTestOutcome result={phase.result} />,
    });
  }
  const word = words[phase.answers.length];
  const applying = word === undefined;
  return frame({
    testID: `${testID}-question`,
    footer: (
      <View style={styles.pair}>
        <View style={styles.half}>
          <Button
            variant="neutral"
            testID={`${testID}-unknown`}
            label={strings.knowledge.unknown}
            disabled={applying}
            onPress={() => {
              answer(false);
            }}
          />
        </View>
        <View style={styles.half}>
          <Button
            testID={`${testID}-known`}
            label={strings.knowledge.known}
            busy={applying}
            onPress={() => {
              answer(true);
            }}
          />
        </View>
      </View>
    ),
    children: word !== undefined && (
      <>
        <Segments
          count={words.length}
          colorOf={(index) =>
            index < phase.answers.length
              ? colors.accent
              : index === phase.answers.length
                ? colors.muted
                : colors.silhouette
          }
          style={rarityTestLayout.progressBar}
        />
        <View style={styles.askLine}>
          {[progressOf(phase.answers.length), '·', strings.rarityTest.question].map(
            (part, index) => (
              <Text
                key={index}
                testID={index === 0 ? `${testID}-progress` : undefined}
                {...voice}
                maxFontSizeMultiplier={fontScaleCap.text}
                style={[typeStyle('progressCount', tokens), { color: colors.muted }]}
              >
                {part}
              </Text>
            ),
          )}
        </View>
        <WholeWordsText
          text={word.lemma}
          typeRole="heroLemma"
          testID={`${testID}-lemma`}
          accessibilityLabel={word.accessibilityLabel}
          {...voice}
          maxFontSizeMultiplier={fontScaleCap.number}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={[typeStyle('heroLemma', tokens), { color: colors.ink }]}
        />
      </>
    ),
  });
}

/** A row of skewed segments, coloured one by one; VoiceOver skips it, as the text beside it says the same. */
function Segments({
  count,
  colorOf,
  style,
}: {
  count: number;
  colorOf: (index: number) => string;
  style: { height: number; gap: number };
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.segments, { gap: style.gap }]}
    >
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[styles.segment, { height: style.height, backgroundColor: colorOf(index) }]}
        />
      ))}
    </View>
  );
}

/**
 * The result (screen 93, XSettings t7): a card with the top of the Rarity
 * Range as a big number cut by its top right corner, beside the heading that
 * says the range the test set and whether that changed it, five
 * bars lit up to it, and how many Words the reader knew. The heading is a few
 * short words, so each fits its line beside the number.
 */
function RarityTestOutcome({ result }: { result: RarityTestResult }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice, strings, mixPlace } = useEdition();
  const [lowest] = RARITIES;
  const range = rarityRangeLabel(strings.settings.rarity, { from: lowest, to: result.top });
  return (
    <View
      style={[
        styles.outcome,
        { backgroundColor: colors.surfaceSunken, borderRadius: rarityTestLayout.resultCard.radius },
      ]}
    >
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        maxFontSizeMultiplier={fontScaleCap.number}
        style={[typeStyle('rarityTestNumber', tokens), styles.number, { color: colors.accent }]}
      >
        {String(result.top)}
      </Text>
      <Text
        accessibilityRole="header"
        {...voice}
        maxFontSizeMultiplier={fontScaleCap.number}
        style={[typeStyle('rarityTestResult', tokens), styles.outcomeLine, { color: colors.ink }]}
      >
        {fill(result.changed ? strings.rarityTest.resultChanged : strings.rarityTest.resultKept, {
          range,
        })}
      </Text>
      <View style={styles.outcomeLine}>
        <Segments
          count={RARITIES.length}
          // Rarities 1…5 in order: those up to the ceiling are lit.
          colorOf={(index) => (index < result.top ? colors.accent : colors.silhouette)}
          style={rarityTestLayout.rarityBars}
        />
      </View>
      <Text
        {...voice}
        maxFontSizeMultiplier={fontScaleCap.text}
        style={[typeStyle('statsNote', tokens), styles.outcomeNote, { color: colors.muted }]}
      >
        {fill(strings.rarityTest.known[mixPlace], {
          known: String(result.known),
          total: String(result.total),
        })}
      </Text>
    </View>
  );
}

/** The quiet text button under the result's «ГОТОВО». */
function QuietButton({
  testID,
  label,
  onPress,
}: {
  testID: string;
  label: string;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const { voice } = useEdition();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...voice}
      onPress={onPress}
      style={styles.quiet}
    >
      <Text
        maxFontSizeMultiplier={fontScaleCap.number}
        style={[typeStyle('quietAction', tokens), { color: tokens.colors.ink }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: space[3] },
  askLine: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1] },
  half: { flex: 1 },
  segments: { flexDirection: 'row', alignSelf: 'stretch' },
  segment: { flex: 1, transform: [{ skewX: rarityTestLayout.skew }] },
  outcome: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    paddingVertical: rarityTestLayout.resultCard.paddingVertical,
    paddingHorizontal: rarityTestLayout.resultCard.paddingHorizontal,
    gap: rarityTestLayout.resultCard.gap,
  },
  number: { position: 'absolute', ...rarityTestLayout.number },
  outcomeLine: { maxWidth: rarityTestLayout.resultWidth },
  outcomeNote: { maxWidth: rarityTestLayout.noteWidth },
  quiet: { minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' },
});
