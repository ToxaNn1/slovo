import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';

import type { Rarity } from '@slovo/contracts';

import { fill, useEdition } from '../providers/EditionProvider';
import { PrimaryButton } from '../primitives/PrimaryButton';
import { SecondaryButton } from '../primitives/SecondaryButton';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { typeSize } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import {
  HEADLINE_MAX_FONT_SCALE,
  HERO_LEMMA,
  stepStyles,
  TEXT_MAX_FONT_SCALE,
} from './OnboardingStep';

/** A Word the Rarity Test asks about. */
export interface RarityTestQuestion {
  readonly rarity: Rarity;
  /** The Lemma with its Stress mark. */
  readonly lemma: string;
  /** What VoiceOver reads for the Lemma, which says where the Stress falls. */
  readonly accessibilityLabel: string;
}

/** A screen of the Rarity Test, which its caller draws in its own frame. */
export interface RarityTestScreen {
  readonly testID: string;
  /** The screen's buttons, pinned under the content. */
  readonly footer: ReactNode;
  readonly children: ReactNode;
}

/** Where the Rarity Test is: the Word asked about, or the floor it set. */
type RarityTestPhase =
  | { readonly kind: 'asking'; readonly answers: readonly { rarity: Rarity; known: boolean }[] }
  | { readonly kind: 'result'; readonly floor: Rarity };

/** A Rarity Test screen's title, as VoiceOver's header. */
export function RarityTestTitle({ children }: { children: string }) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <Text
      accessibilityRole="header"
      {...voice}
      maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
      style={[stepStyles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
    >
      {children}
    </Text>
  );
}

/**
 * The Rarity Test's questions and result, the same in onboarding and from
 * Settings: each Word in turn by its Lemma with Stress under «{n} з {total}»,
 * with «Знаю» and «Не знаю»; the last answer applies them all, and the result
 * says «Ваш рівень: від {n}» over «Далі». The caller draws each screen in its
 * own frame.
 */
export function RarityTestQuestions({
  testID,
  words,
  onApply,
  onDone,
  frame,
}: {
  /** The prefix of the screens' and buttons' testIDs. */
  testID: string;
  /** The Words to ask about, in the order asked. */
  words: readonly RarityTestQuestion[];
  /**
   * Applies the answers and resolves to the Rarity Floor they set, or to
   * nothing when none was set; it never rejects.
   */
  onApply: (answers: readonly { rarity: Rarity; known: boolean }[]) => Promise<Rarity | undefined>;
  /** Goes on from the result, or at once when the answers set no floor. */
  onDone: () => void;
  frame: (screen: RarityTestScreen) => ReactNode;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice, strings } = useEdition();
  const [phase, setPhase] = useState<RarityTestPhase>({ kind: 'asking', answers: [] });
  /** Whether the answers are applied, so a second tap on the last Word applies nothing. */
  const applied = useRef(false);
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
    if (phase.kind !== 'asking') return;
    const word = words[phase.answers.length];
    if (word === undefined) return;
    const answers = [...phase.answers, { rarity: word.rarity, known }];
    setPhase({ kind: 'asking', answers });
    if (answers.length < words.length || applied.current) return;
    applied.current = true;
    void onApply(answers).then((floor) => {
      if (floor === undefined) onDone();
      else setPhase({ kind: 'result', floor });
    });
  };

  if (phase.kind === 'result') {
    return frame({
      testID: `${testID}-result`,
      footer: (
        <PrimaryButton
          testID={`${testID}-next`}
          label={strings.onboarding.mix.next}
          onPress={onDone}
        />
      ),
      children: (
        <RarityTestTitle>
          {fill(strings.rarityTest.result, { n: String(phase.floor) })}
        </RarityTestTitle>
      ),
    });
  }
  const word = words[phase.answers.length];
  const applying = word === undefined;
  return frame({
    testID: `${testID}-question`,
    footer: (
      <>
        <PrimaryButton
          testID={`${testID}-known`}
          label={strings.knowledge.known}
          busy={applying}
          onPress={() => {
            answer(true);
          }}
        />
        <SecondaryButton
          testID={`${testID}-unknown`}
          label={strings.knowledge.unknown}
          disabled={applying}
          onPress={() => {
            answer(false);
          }}
        />
      </>
    ),
    children: word !== undefined && (
      <>
        <Text
          testID={`${testID}-progress`}
          {...voice}
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[styles.counter, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {progressOf(phase.answers.length)}
        </Text>
        <WholeWordsText
          text={word.lemma}
          size={HERO_LEMMA}
          tracking={-0.02}
          testID={`${testID}-lemma`}
          accessibilityLabel={word.accessibilityLabel}
          {...voice}
          maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={{ color: colors.ink, fontFamily: fontFamilies.word, fontWeight: '500' }}
        />
      </>
    ),
  });
}

const styles = StyleSheet.create({
  counter: { fontSize: typeSize.body, fontWeight: '600' },
});
