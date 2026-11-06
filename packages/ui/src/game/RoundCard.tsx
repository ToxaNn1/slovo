'use no memo';
// Split from the Game Round, whose modules the React Compiler skips (ADR 0059).

import type { TextRange } from '@slovo/core';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { roundLayout, space, typeStyle } from '../tokens';

/** Whether a label ends in punctuation of its own, such as «?», so VoiceOver needs no full stop after it. */
const ENDS_IN_PUNCTUATION = /\p{P}$/u;

/**
 * The Round's prompt (`game-round-dark`, `game-round-correction-answered-light`):
 * its label over the prompt on a surface card with the Edition's corners, the
 * highlight, such as a non-standard form, on the sunken fill and underlined in
 * the accent. VoiceOver reads it before the options, then names the highlight;
 * a gap it reads in its place, as the Edition calls it.
 * A Definition, such as a Word's in «Звідки слово», stands under the prompt,
 * and VoiceOver reads it after the prompt.
 * An answer drawn in the prompt's place, such as the vowel buttons, stands in
 * for the prompt, and VoiceOver reads the label, then each of its buttons.
 */
export function RoundCard({
  label,
  prompt,
  highlight,
  gap,
  definition,
  labelShown = false,
  children,
}: {
  label: string;
  /** Whether the card shows its label over the prompt, as in the Feed; a Game's Round shows it in its head. */
  labelShown?: boolean;
  prompt: string;
  /** The part of the prompt to mark; nothing to mark. */
  highlight: TextRange | undefined;
  /** The gap in the prompt, which VoiceOver reads as one and which is no highlight to name; none. */
  gap: TextRange | undefined;
  /** The Definition under the prompt; none to show. */
  definition?: string | undefined;
  /** What the card shows for the prompt, the answer drawn in it; the prompt's text if nothing. */
  children?: ReactNode;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { strings, voice } = useEdition();
  const read =
    gap === undefined
      ? prompt
      : `${prompt.slice(0, gap.start)}${strings.game.round.gap.voiceOver}${prompt.slice(gap.end)}`;
  const marked =
    highlight === undefined || gap !== undefined
      ? undefined
      : fill(strings.game.round.highlight, {
          text: prompt.slice(highlight.start, highlight.end),
        });
  const defined =
    definition === undefined ? '' : `${ENDS_IN_PUNCTUATION.test(read) ? '' : '.'} ${definition}`;
  return (
    <View
      testID="game-prompt"
      accessible={children === undefined}
      accessibilityLabel={
        children === undefined
          ? [`${label}${ENDS_IN_PUNCTUATION.test(label) ? '' : '.'} ${read}${defined}`, marked]
              .filter(Boolean)
              .join(' ')
          : undefined
      }
      {...voice}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.card },
      ]}
    >
      {labelShown && (
        <Text
          maxFontSizeMultiplier={roundLayout.textMaxFontScale}
          {...voice}
          style={[typeStyle('roundLabel', tokens), { color: colors.muted }]}
        >
          {label}
        </Text>
      )}
      {children ?? (
        <WholeWordsText
          text={prompt}
          typeRole="roundPrompt"
          style={[typeStyle('roundPrompt', tokens), { color: colors.ink }]}
          highlight={
            highlight === undefined
              ? undefined
              : {
                  range: highlight,
                  style: {
                    backgroundColor: colors.surfaceSunken,
                    textDecorationLine: 'underline',
                    textDecorationColor: colors.accent,
                  },
                }
          }
        />
      )}
      {definition !== undefined && (
        <Text
          testID="game-definition"
          maxFontSizeMultiplier={roundLayout.textMaxFontScale}
          {...voice}
          style={[typeStyle('roundExplanation', tokens), { color: colors.ink }]}
        >
          {definition}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: roundLayout.cardMinHeight,
    justifyContent: 'center',
    gap: space[4],
    paddingVertical: roundLayout.cardPaddingVertical,
    paddingHorizontal: space[6],
    borderWidth: 1,
  },
});
