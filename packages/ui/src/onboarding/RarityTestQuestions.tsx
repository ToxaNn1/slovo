import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Text } from 'react-native';

import type { Rarity } from '@slovo/contracts';

import { fill, useEdition } from '../providers/EditionProvider';
import { Button } from '../primitives/Button';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { fontScaleCap, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

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

/** Where the Rarity Test is: the Word asked about, or the Rarity Ceiling it set. */
type RarityTestPhase =
  | { readonly kind: 'asking'; readonly answers: readonly { rarity: Rarity; known: boolean }[] }
  | { readonly kind: 'result'; readonly ceiling: Rarity };

/** A Rarity Test screen's title, as VoiceOver's header. */
export function RarityTestTitle({ children }: { children: string }) {
  const tokens = useTokens();
  const { voice } = useEdition();
  return (
    <Text
      accessibilityRole="header"
      {...voice}
      maxFontSizeMultiplier={fontScaleCap.number}
      style={[typeStyle('stepTitle', tokens), { color: tokens.colors.ink }]}
    >
      {children}
    </Text>
  );
}

/**
 * The Rarity Test's questions and result, the same in onboarding and from
 * Settings: each Word in turn by its Lemma with Stress under «{n} з {total}»,
 * with «Знаю» and «Не знаю»; the last answer applies them all, and the result
 * says «Твоя рідкість: до {n}» over «Далі». The caller draws each screen in its
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
   * Applies the answers and resolves to the Rarity Ceiling they set, or to
   * nothing when none was set; it never rejects.
   */
  onApply: (answers: readonly { rarity: Rarity; known: boolean }[]) => Promise<Rarity | undefined>;
  /** Goes on from the result, or at once when the answers set no ceiling. */
  onDone: () => void;
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
    void onApply(answers).then((ceiling) => {
      if (ceiling === undefined) onDone();
      else setPhase({ kind: 'result', ceiling });
    });
  };

  if (phase.kind === 'result') {
    return frame({
      testID: `${testID}-result`,
      footer: <Button testID={`${testID}-next`} label={strings.rarityTest.next} onPress={onDone} />,
      children: (
        <RarityTestTitle>
          {fill(strings.rarityTest.result, { n: String(phase.ceiling) })}
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
        <Button
          testID={`${testID}-known`}
          label={strings.knowledge.known}
          busy={applying}
          onPress={() => {
            answer(true);
          }}
        />
        <Button
          variant="neutral"
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
          maxFontSizeMultiplier={fontScaleCap.text}
          style={[typeStyle('progressCount', tokens), { color: colors.muted }]}
        >
          {progressOf(phase.answers.length)}
        </Text>
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
