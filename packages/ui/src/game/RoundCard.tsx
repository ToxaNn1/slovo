'use no memo';
// Split from the Game Round, whose modules the React Compiler skips.

import type { TextRange } from '@slovo/core';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { useRoundLook } from './round-look';
import {
  roundHeader,
  roundLayout,
  quickQuestionCard,
  space,
  typeStyle,
  type TypeRole,
} from '../tokens';

/** The longest question the board sets in the large display face on the ground; a longer one takes the text face. */
const DISPLAY_MOST = 40;

/**
 * Whether a part ends in a stop of its own, such as «?», maybe inside a closing quote or bracket,
 * so VoiceOver needs no full stop after it. A closing quote alone is no stop.
 */
const ENDS_IN_STOP = /[.!?…:;,][\p{Pe}\p{Pf}"']*$/u;

/** Joins the parts VoiceOver reads, giving each a stop unless it ends in punctuation. */
function joinStopped(parts: readonly (string | undefined)[]): string {
  return parts
    .flatMap((part) => (part === undefined || part === '' ? [] : [part]))
    .map((part, index, kept) =>
      index === kept.length - 1 || ENDS_IN_STOP.test(part) ? part : `${part}.`,
    )
    .join(' ');
}

/**
 * How a restyled Round's card looks (board 07, spec #1674): a «Впиши слово»
 * Round names the wrong form it asks to replace, «замість «вірогідно»», over
 * its sentence; a «Звідки слово» Round shows its Word big on a sunken tile.
 * On the ground (spec #1880) «Склади вислів» shows its label as an ink
 * heading over the meaning in grey (`heading`), and «Англіцизми» draws its
 * anglicism in red in the sentence (`redMark`).
 */
export type RoundFace =
  | { readonly look: 'instead'; readonly instead: string }
  | { readonly look: 'word' }
  | { readonly look: 'heading' }
  | { readonly look: 'redMark' };

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
 * In a Round on the ground the prompt stands on the background
 * with no card, in the large display face up to 40 characters and the text
 * face past that, or in the one face the Round asks for, a long question in
 * the display face sized down; the Mascot, if any, stands beside it.
 * An ink-headed Round on the ground (board g3, g4) shows only its ask and
 * its face: «Впиши слово» the wrong form with no sentence, «Звідки слово»
 * the Word whole on a full-width tile with no Definition.
 * A head over the answer, such as «Де наголос?», stands alone, beside the
 * Mascot if any, level with its foot, and the answer under it takes the full
 * width in the middle of the room left, so a long Word keeps to one line.
 */
export function RoundCard({
  label,
  prompt,
  highlight,
  gap,
  definition,
  face,
  quickQuestion,
  children,
  head,
}: {
  label: string;
  prompt: string;
  /** The part of the prompt to mark; nothing to mark. */
  highlight: TextRange | undefined;
  /** The gap in the prompt, which VoiceOver reads as one and which is no highlight to name; none. */
  gap: TextRange | undefined;
  /** The Definition under the prompt; none to show. */
  definition?: string | undefined;
  /** The restyled look of the card; the plain prompt if none. */
  face?: RoundFace | undefined;
  /**
   * Drawn in a Quick Question's own card (board f3): no card of its own and
   * no label, which the Quick Question shows on its tag; the prompt bigger
   * and under it the non-standard form the Tip replaces, if any. A Game's Round if none.
   */
  quickQuestion?: { readonly instead: string | undefined } | undefined;
  /** What the card shows for the prompt, the answer drawn in it; the prompt's text if nothing. */
  children?: ReactNode;
  /**
   * The ask over the answer drawn in the prompt's place, such as «Де наголос?»;
   * beside the Mascot it stands alone, so the answer under it keeps the full width.
   */
  head?: ReactNode;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const look = useRoundLook();
  // The board's ink-headed faces show their ask and nothing of the Round besides.
  const bare =
    quickQuestion === undefined &&
    look.inkHeaded &&
    (face?.look === 'instead' || face?.look === 'word');
  const asks = face?.look === 'instead' || face?.look === 'heading' || bare;
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
  const spoken = joinStopped([
    label,
    face?.look === 'instead' ? face.instead : undefined,
    bare && face.look === 'instead' ? undefined : read,
    quickQuestion?.instead,
    bare ? undefined : definition,
  ]);
  const promptRole: TypeRole =
    quickQuestion !== undefined
      ? 'quickQuestionPrompt'
      : look.questionFace === 'text' ||
          (look.questionFace === 'byLength' && Array.from(prompt).length > DISPLAY_MOST)
        ? 'roundPrompt'
        : 'roundAsk';
  // A head stands over the answer, beside the Mascot if any, the answer in the middle of the room under it.
  const headed = head !== undefined && quickQuestion === undefined;
  const card = (
    <View
      testID="game-prompt"
      accessible={children === undefined}
      accessibilityLabel={
        children === undefined
          ? [spoken, bare ? undefined : marked].filter(Boolean).join(' ')
          : undefined
      }
      {...voice}
      style={quickQuestion === undefined ? styles.onGround : styles.inCard}
    >
      {!headed && head}
      {asks && <RoundAsk ask={label} heading={false} />}
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
          <WordTile word={prompt} whole={bare} />
        ) : bare ? null : (
          <WholeWordsText
            text={prompt}
            typeRole={promptRole}
            // A prompt too big for its lines takes a lower step of the cards' one title
            // scale; on the ground the text face already sets a long one.
            lines={promptRole === 'roundPrompt' ? undefined : roundLayout.promptLines}
            stepped={promptRole !== 'roundPrompt'}
            maxFontSizeMultiplier={
              promptRole === 'roundPrompt' ? undefined : roundLayout.textMaxFontScale
            }
            style={[
              typeStyle(promptRole, tokens),
              { color: face?.look === 'heading' ? colors.muted : colors.ink },
            ]}
            highlight={
              highlight === undefined
                ? undefined
                : {
                    range: highlight,
                    style:
                      face?.look === 'redMark'
                        ? { color: colors.accent }
                        : {
                            backgroundColor: colors.surfaceSunken,
                            textDecorationLine: 'underline',
                            textDecorationColor: colors.accent,
                          },
                  }
            }
          />
        ))}
      {quickQuestion?.instead !== undefined && (
        <Text
          testID="game-instead"
          maxFontSizeMultiplier={roundLayout.textMaxFontScale}
          {...voice}
          style={[typeStyle('quickQuestionInstead', tokens), { color: colors.muted }]}
        >
          {quickQuestion.instead}
        </Text>
      )}
      {definition !== undefined && !bare && (
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
  if (headed)
    return (
      <View style={styles.headed}>
        <View style={[styles.besideMascot, styles.headBesideMascot]}>
          <View style={styles.question}>{head}</View>
          {look.mascot}
        </View>
        <View style={styles.centred}>{card}</View>
      </View>
    );
  if (quickQuestion !== undefined || look.mascot === undefined) return card;
  return (
    <View style={styles.besideMascot}>
      <View style={styles.question}>{card}</View>
      {look.mascot}
    </View>
  );
}

/**
 * A restyled Round's ask in ink over its face (board 06 «Наголос», g3, g4),
 * such as «Як сказати краще?» or «Де наголос?»; VoiceOver reads it as the
 * Round's heading where the card does not read it, as over the vowel buttons.
 */
export function RoundAsk({ ask, heading }: { ask: string; heading: boolean }) {
  const tokens = useTokens();
  const { voice } = useEdition();
  return (
    <Text
      testID="game-ask"
      maxFontSizeMultiplier={roundLayout.textMaxFontScale}
      {...(heading ? { accessibilityRole: 'header' as const } : {})}
      {...voice}
      style={[typeStyle('roundAsk', tokens), { color: tokens.colors.ink }]}
    >
      {ask}
    </Text>
  );
}

/**
 * The Game Mode and the Round over the question on the ground (board «slogo
 * game last»), muted small caps, «НАГОЛОС · 1/10»; VoiceOver reads it as
 * the Round's heading, the header on the ground having no title.
 */
export function RoundKicker({ kicker }: { kicker: string }) {
  const tokens = useTokens();
  const { voice } = useEdition();
  return (
    <Text
      testID="game-kicker"
      accessibilityRole="header"
      maxFontSizeMultiplier={roundLayout.textMaxFontScale}
      {...voice}
      style={[typeStyle('roundKicker', tokens), styles.kicker, { color: tokens.colors.muted }]}
    >
      {kicker}
    </Text>
  );
}

/**
 * The Word of a «Звідки слово» Round: big on a sunken tile, its first letter
 * faded (board 07 g4, spec #1674), or whole at the foot of a full-width tile
 * (board g4 on the ground). The card reads the whole Word as one, never its
 * letters apart.
 */
function WordTile({ word, whole }: { word: string; whole: boolean }) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  const [first = '', ...rest] = word;
  return (
    <View
      testID="game-word"
      style={[
        whole ? styles.wholeTile : styles.tile,
        { backgroundColor: colors.surfaceSunken, borderRadius: radii.card },
      ]}
    >
      <Text
        maxFontSizeMultiplier={roundLayout.textMaxFontScale}
        {...voice}
        style={[typeStyle(whole ? 'roundOriginWord' : 'roundAsk', tokens), { color: colors.ink }]}
      >
        {whole ? (
          word
        ) : (
          <>
            <Text style={{ color: colors.muted }}>{first}</Text>
            {rest.join('')}
          </>
        )}
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
  wholeTile: {
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
    minHeight: roundLayout.originTileMinHeight,
    padding: space[4],
  },
  inCard: { gap: quickQuestionCard.gap },
  onGround: { gap: space[4] },
  besideMascot: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  // The board sets the Mascot level with the foot of the head and the answer in the middle of the room under it.
  headBesideMascot: { alignItems: 'flex-end' },
  headed: { flexGrow: 1, gap: space[4] },
  centred: { flexGrow: 1, justifyContent: 'center' },
  kicker: { marginBottom: roundHeader.ground.kickerGap },
  question: { flex: 1 },
});
