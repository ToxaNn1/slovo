import { GAME_LIVES, GAME_ROUNDS, type RoundAnswer, type RoundOption } from '@slovo/core';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BottomSheet } from './BottomSheet';
import { CardCorners } from './DecorSlots';
import { fill, useEdition } from './EditionProvider';
import { HEART_PATH } from './FavoriteButton';
import { PrimaryButton } from './PrimaryButton';
import { stressLabel } from './stress-label';
import { minTouchTarget, overlineType, space, withAlpha } from './tokens';
import { useSchemeColors, useTokens } from './TokensProvider';
import { WholeWordsText } from './WholeWordsText';

/** A Life's size and the gap between Lives, from the design. */
const LIFE_SIZE = 20;
const LIFE_GAP = 3;
/** The height of the Round's progress bar. */
const BAR_HEIGHT = 4;
/** An answer option's least height, from the design (above the 44 pt touch target). */
const OPTION_HEIGHT = 58;
/** How much an answered Round's other options fade. */
const DIMMED_OPACITY = 0.45;
/** How far the largest text sizes of iOS may scale the smaller text, so it never breaks a word. */
const TEXT_MAX_FONT_SCALE = 1.5;
/** The prompt's, an option's and the sheet's answer's sizes, from the design. */
const PROMPT_SIZE = { fontSize: 25, lineHeight: 25 * 1.35 };
const OPTION_SIZE = { fontSize: 21, lineHeight: 21 * 1.3 };
const SHEET_ANSWER_SIZE = { fontSize: 30, lineHeight: 30 * 1.3 };
/** The text on a filled option. */
const ON_FILL = '#FFFFFF';

/**
 * The Round's header (`game-round-dark`): the Rounds passed over a bar that
 * fills as they pass, and the Lives on the right, full in the heart colour,
 * lost as an outline. `leading` sits at its start, where the exit goes.
 */
export function GameHeader({
  roundsPassed,
  lives,
  leading,
}: {
  roundsPassed: number;
  lives: number;
  leading?: ReactNode;
}) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
  const words = strings.game.round;
  const progress = { passed: String(roundsPassed), total: String(GAME_ROUNDS) };
  return (
    <View style={[styles.header, { paddingLeft: leading === undefined ? space[6] : space[3] }]}>
      {leading}
      <View
        testID="game-progress"
        accessible
        accessibilityLabel={fill(words.progressLabel, progress)}
        {...voice}
        style={styles.progress}
      >
        <Text
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[styles.progressText, { color: colors.ink, fontFamily: fontFamilies.ui }]}
        >
          {fill(words.progress, progress)}
        </Text>
        <View style={[styles.bar, { backgroundColor: colors.track }]}>
          {/* The share of the Rounds passed, as flex weights, so the bar needs no width. */}
          <View style={{ flex: roundsPassed, backgroundColor: colors.accent }} />
          <View style={{ flex: GAME_ROUNDS - roundsPassed }} />
        </View>
      </View>
      <View
        testID="game-lives"
        accessible
        accessibilityLabel={fill(words.lives, { count: String(lives), total: String(GAME_LIVES) })}
        {...voice}
        style={styles.lives}
      >
        {Array.from({ length: GAME_LIVES }, (_, life) => (
          <Svg key={life} width={LIFE_SIZE} height={LIFE_SIZE} viewBox="0 0 24 24">
            <Path
              d={HEART_PATH}
              fill={life < lives ? colors.heart : 'none'}
              stroke={life < lives ? colors.heart : withAlpha(colors.ink, 0.32)}
              strokeWidth={1.8}
            />
          </Svg>
        ))}
      </View>
    </View>
  );
}

/**
 * The Round's prompt (`game-round-dark`): its label over the prompt on a
 * surface card with the Edition's corners. VoiceOver reads it before the
 * options.
 */
export function RoundCard({ label, prompt }: { label: string; prompt: string }) {
  const { colors, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  return (
    <View
      testID="game-prompt"
      accessible
      accessibilityLabel={`${label}. ${prompt}`}
      {...voice}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.card },
      ]}
    >
      <CardCorners corners={['topLeft', 'bottomRight']} />
      <Text
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        style={[overlineType, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {label}
      </Text>
      <WholeWordsText
        text={prompt}
        size={PROMPT_SIZE}
        tracking={0}
        style={{ color: colors.ink, fontFamily: fontFamilies.word }}
      />
    </View>
  );
}

/**
 * One option of a Round, 58 pt tall. Once the Round is answered, the right
 * option fills in the correct colour with «Правильно», a wrong choice in the
 * wrong colour with «Ваш вибір», and the others fade; the fills are the light
 * scheme's in both Themes, under white text. VoiceOver reads the option with
 * its Stress, then its tag, and the faded ones as dimmed.
 */
export function AnswerOption({
  option,
  place,
  answer,
  onPress,
}: {
  option: RoundOption;
  /** Its place among the options. */
  place: number;
  /** The Round's answer, once given. */
  answer: RoundAnswer | undefined;
  onPress: () => void;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const light = useSchemeColors('light');
  const { strings, voice } = useEdition();
  const tag =
    answer === undefined
      ? undefined
      : place === answer.correct
        ? { text: strings.game.round.correct, fill: light.correct }
        : place === answer.chosen
          ? { text: strings.game.round.chosen, fill: light.wrong }
          : undefined;
  const dimmed = answer !== undefined && tag === undefined;
  return (
    <Pressable
      testID={`game-option-${String(place)}`}
      accessibilityRole="button"
      accessibilityLabel={[
        stressLabel(strings.wordCard, option.text, option.stressedVowels),
        tag?.text,
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityState={{ disabled: dimmed }}
      {...voice}
      disabled={answer !== undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: tag?.fill ?? (pressed ? colors.surfaceSunken : colors.surface),
          borderColor: tag?.fill ?? colors.line,
          borderRadius: radii.button,
          opacity: dimmed ? DIMMED_OPACITY : 1,
        },
      ]}
    >
      <View style={styles.optionText}>
        <WholeWordsText
          text={option.text}
          size={OPTION_SIZE}
          tracking={0}
          style={[
            styles.optionWord,
            { color: tag === undefined ? colors.ink : ON_FILL, fontFamily: fontFamilies.word },
          ]}
        />
      </View>
      {tag === undefined ? null : (
        <Text
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[styles.tag, { color: ON_FILL, fontFamily: fontFamilies.ui }]}
        >
          {tag.text}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * The sheet after an answer (`game-round-correct-dark`,
 * `game-round-wrong-dark`): «Правильно!» or «Не цього разу», the right answer
 * with its Stress and its Example with the author, or the answer alone, and
 * «Далі», the only way to close it. It is drawn in the other colour scheme
 * and keeps what it showed while it slides away.
 */
export function AnswerSheet({
  answer,
  onNext,
}: {
  answer: RoundAnswer | undefined;
  onNext: () => void;
}) {
  // The answer it shows, kept while the sheet leaves after «Далі» took the Round's away.
  const [shown, setShown] = useState(answer);
  if (answer !== undefined && answer !== shown) setShown(answer);
  return (
    <BottomSheet visible={answer !== undefined} inverted testID="game-sheet">
      {shown === undefined ? null : <AnswerSheetContent answer={shown} onNext={onNext} />}
    </BottomSheet>
  );
}

function AnswerSheetContent({ answer, onNext }: { answer: RoundAnswer; onNext: () => void }) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
  const right = answer.chosen === answer.correct;
  const { example } = answer.sheet;
  return (
    <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
      <Text
        testID="game-sheet-title"
        accessibilityRole="header"
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        {...voice}
        style={[
          styles.sheetTitle,
          { color: right ? colors.correct : colors.wrong, fontFamily: fontFamilies.ui },
        ]}
      >
        {right ? strings.game.sheet.correct : strings.game.sheet.wrong}
      </Text>
      <WholeWordsText
        text={answer.sheet.answer.text}
        size={SHEET_ANSWER_SIZE}
        tracking={0}
        accessibilityLabel={stressLabel(
          strings.wordCard,
          answer.sheet.answer.text,
          answer.sheet.answer.stressedVowels,
        )}
        {...voice}
        style={[styles.sheetAnswer, { color: colors.ink, fontFamily: fontFamilies.word }]}
      />
      {example === undefined ? null : (
        <View accessible {...voice}>
          <Text
            maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
            style={[styles.example, { color: colors.inkSecondary, fontFamily: fontFamilies.word }]}
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
      <View style={styles.next}>
        <PrimaryButton testID="game-next" label={strings.game.sheet.next} onPress={onNext} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: minTouchTarget,
    paddingRight: space[4],
  },
  progress: { flex: 1, gap: 6 },
  progressText: { fontSize: 13, fontWeight: '700' },
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  lives: { flexDirection: 'row', gap: LIFE_GAP },
  card: {
    minHeight: 220,
    justifyContent: 'center',
    gap: space[4],
    paddingVertical: 30,
    paddingHorizontal: space[6],
    borderWidth: 1,
  },
  option: {
    minHeight: OPTION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingHorizontal: space[5],
    paddingVertical: space[2],
    borderWidth: 1,
  },
  optionText: { flex: 1 },
  optionWord: { fontWeight: '500' },
  tag: { fontSize: 13, fontWeight: '700' },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  sheetContent: { gap: 14, paddingHorizontal: space[1], paddingBottom: space[2] },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  sheetAnswer: { fontWeight: '500' },
  example: { fontSize: 17, lineHeight: 17 * 1.5, fontStyle: 'italic' },
  author: { marginTop: space[1], fontSize: 13, fontWeight: '500' },
  next: { marginTop: 6 },
});
