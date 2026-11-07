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
 * How a restyled Round's card looks (board 07, spec #1674): a «Впиши слово»
 * Round names the wrong form it asks to replace, «замість «вірогідно»», over
 * its sentence; a «Звідки слово» Round shows its Word big on a sunken tile.
 */
export type RoundFace =
  { readonly look: 'instead'; readonly instead: string } | { readonly look: 'word' };

/**
 * The Round's prompt (`game-round-dark`, `game-round-correction-answered-light`):
 * its label over the prompt on a surface card with the Edition's corners, the
 * highlight, such as a non-standard form, on the sunken fill and underlined in
 * the accent. VoiceOver reads it before the options, then names the highlight;
 * a gap it reads in its place, as the Edition calls it.
 * A Round that names the form it asks to replace (board 07 g3) shows its
 * label as its ask, «Як сказати краще?», and the form muted under it.
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
  face,
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
  /** The restyled look of the card; the plain prompt if none. */
  face?: RoundFace | undefined;
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
  const said = face?.look === 'instead' ? `${face.instead}. ` : '';
  const defined =
    definition === undefined ? '' : `${ENDS_IN_PUNCTUATION.test(read) ? '' : '.'} ${definition}`;
  return (
    <View
      testID="game-prompt"
      accessible={children === undefined}
      accessibilityLabel={
        children === undefined
          ? [
              `${label}${ENDS_IN_PUNCTUATION.test(label) ? '' : '.'} ${said}${read}${defined}`,
              marked,
            ]
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
      {labelShown && face?.look !== 'instead' && (
        <Text
          maxFontSizeMultiplier={roundLayout.textMaxFontScale}
          {...voice}
          style={[typeStyle('roundLabel', tokens), { color: colors.muted }]}
        >
          {label}
        </Text>
      )}
      {face?.look === 'instead' && (
        <Text
          testID="game-ask"
          maxFontSizeMultiplier={roundLayout.textMaxFontScale}
          {...voice}
          style={[typeStyle('roundAsk', tokens), { color: colors.ink }]}
        >
          {label}
        </Text>
      )}
      {face?.look === 'instead' && (
        <Text
          testID="game-instead"
          maxFontSizeMultiplier={roundLayout.textMaxFontScale}
          {...voice}
          style={[typeStyle('roundInstead', tokens), { color: colors.muted }]}
        >
          {face.instead}
        </Text>
      )}
      {children ??
        (face?.look === 'word' ? (
          <WordTile word={prompt} />
        ) : (
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
        ))}
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

/**
 * The Word of a «Звідки слово» Round (board 07 g4): big on a sunken tile, its
 * first letter faded. The card reads the whole Word as one, never its letters apart.
 */
function WordTile({ word }: { word: string }) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  const [first = '', ...rest] = word;
  return (
    <View
      testID="game-word"
      style={[styles.tile, { backgroundColor: colors.surfaceSunken, borderRadius: radii.card }]}
    >
      <Text
        maxFontSizeMultiplier={roundLayout.textMaxFontScale}
        {...voice}
        style={[typeStyle('roundAsk', tokens), { color: colors.ink }]}
      >
        <Text style={{ color: colors.muted }}>{first}</Text>
        {rest.join('')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignSelf: 'flex-start',
    paddingVertical: space[4],
    paddingHorizontal: space[6],
  },
  card: {
    minHeight: roundLayout.cardMinHeight,
    justifyContent: 'center',
    gap: space[4],
    paddingVertical: roundLayout.cardPaddingVertical,
    paddingHorizontal: space[6],
    borderWidth: 1,
  },
});
