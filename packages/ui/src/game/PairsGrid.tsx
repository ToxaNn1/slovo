'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import {
  stressLabel,
  type GridCell,
  type GridCellState,
  type RoundAnswer,
  type RoundOption,
} from '@slovo/core';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PressedTile, type TileTone } from '../primitives/PressedTile';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { fontScaleCap, pairsGridLayout, space, typeStyle } from '../tokens';
import { useAnswerMotion } from './useAnswerMotion';

/** How far a wrong pair's cells turn (a Word left, a Definition right), how much it fades. */
const CELL_TURN = 3;
const WRONG_OPACITY = 0.6;

/**
 * A grid that stays, as the board draws it: a row's cell height, the gap
 * between its two halves and the diamond over it, and the lines a Word and a
 * Definition take at most.
 */
const STAY_CELL_HEIGHT = 64;
const HALF_GAP = 6;
const DIAMOND = 8;
const WORD_LINES = 2;
const DEFINITION_LINES = 3;

/** The face of a cell in each look. */
const TONES: Record<Look, TileTone> = {
  rest: 'tile',
  selected: 'ink',
  right: 'accent',
  wrong: 'none',
};

/** The answer to a Round of the pairs form. */
type PairsAnswer = Extract<RoundAnswer, { form: 'pairs' }>;

/** What a cell shows: at rest, the selected Word, or a judged pair's right or wrong look. */
type Look = 'rest' | 'selected' | 'right' | 'wrong';

/** A pair given, judged: the places of its Word and the Definition tapped, and whether it was right. */
interface Judged {
  readonly word: number;
  readonly definition: number;
  readonly right: boolean;
}

/** A pair the reader gave in a grid that stays, and how many came before it in the grid, so that each plays its look anew. */
interface Given {
  readonly word: number;
  readonly definition: number;
  readonly tries: number;
}

/** The pair given last, judged once the grid tells where its Word stands; nothing while it is still open. */
function judgedOf(
  given: Given | undefined,
  words: readonly GridCell<RoundOption>[],
): Judged | undefined {
  const state = given === undefined ? undefined : words[given.word]?.state;
  if (given === undefined || state === undefined || state === 'open') return undefined;
  return { word: given.word, definition: given.definition, right: state === 'found' };
}

/**
 * A pairs grid: its Words in a column on the left and its Definitions on the
 * right, each a tile of the design. A tap on a Word selects it, a tap on it
 * again or on another Word changes the selection, and a tap on a Definition
 * then gives the pair, which leaves nothing selected; a Definition tapped
 * before a Word does nothing. The selected Word turns ink. Once the pair is
 * judged, a right pair turns red and pops; a wrong one sinks, mutes, drops
 * and turns aside, a Word left and a Definition right. Under Reduce Motion
 * nothing pops, drops or turns. Nothing shakes; the screen plays the
 * answer's haptic. A pair answered in an earlier Round leaves its places
 * empty, which VoiceOver skips. VoiceOver reads each Word with its Stress and
 * each Definition by its text. Key it by the Round, so a new Round starts
 * with nothing selected.
 *
 * A grid that stays (`pairsStay`, ADR 0139) has the captions «СЛОВО» and
 * «ЗНАЧЕННЯ» over its columns and draws each row as one block of two halves
 * with a small diamond between; a found pair stays red in its place and a
 * missed one leaves its places empty once its wrong look has played, as the
 * next Word is picked. It takes the next pair at once, the Game showing no
 * answered state: key it by the grid, so it keeps its looks from pair to pair.
 */
export function PairsGrid({
  words,
  definitions,
  answer,
  stay = false,
  onAnswer,
}: {
  /** The grid's Words, in the order shown. */
  words: readonly GridCell<RoundOption>[];
  /** The grid's Definitions, in the order shown. */
  definitions: readonly GridCell<string>[];
  /** The Round's answer, once given; none in a grid that stays. */
  answer: PairsAnswer | undefined;
  /** Whether found pairs stay, with the captions and no pause after a pair (`pairsStay`). */
  stay?: boolean;
  /** The place of the Word tapped among the Words, then of the Definition among the Definitions. */
  onAnswer: (word: number, definition: number) => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const keyInk = useSchemeColors('light').ink;
  const { strings, voice } = useEdition();
  const [selected, setSelected] = useState<number>();
  const [given, setGiven] = useState<Given>();
  const judged = stay ? judgedOf(given, words) : answer;
  const lookOf = (
    place: number,
    judgedPlace: number | undefined,
    on: boolean,
    state: GridCellState,
  ): Look => {
    if (judged !== undefined && place === judgedPlace) return judged.right ? 'right' : 'wrong';
    if (stay && state === 'found') return 'right';
    return on ? 'selected' : 'rest';
  };
  const textColor = (look: Look): string =>
    ({ rest: colors.ink, selected: colors.background, right: keyInk, wrong: colors.muted })[look];
  /** Whether a cell leaves its place empty: answered in an earlier Round, or in a grid that stays, missed with its look played. */
  const emptyOf = (state: GridCellState, look: Look) =>
    stay ? state === 'missed' && look !== 'wrong' : state !== 'open';
  /** Whether a cell takes no tap: in a Round answered, or in a grid that stays, of a pair answered. */
  const inertOf = (state: GridCellState) => (stay ? state !== 'open' : answer !== undefined);
  /** The key of a cell, new for the pair given last, so its look plays anew. */
  const keyOf = (place: number, givenPlace: number | undefined) =>
    given !== undefined && place === givenPlace
      ? `${String(place)}-${String(given.tries)}`
      : String(place);

  const wordCell = (place: number) => {
    const cell = words[place];
    if (cell === undefined) return null;
    const { shown, state } = cell;
    const on = selected === place;
    const look = lookOf(place, judged?.word, on, state);
    return (
      <Cell
        key={keyOf(place, given?.word)}
        testID={`pairs-word-${String(place)}`}
        label={stressLabel(strings.wordCard, shown.text, shown.stressedVowels)}
        look={look}
        turn={-CELL_TURN}
        empty={emptyOf(state, look)}
        inert={inertOf(state)}
        half={stay}
        onPress={() => {
          setSelected(on ? undefined : place);
          setGiven(undefined);
        }}
      >
        <WholeWordsText
          text={shown.text}
          typeRole="pairsWord"
          tracking={0}
          numberOfLines={stay ? WORD_LINES : undefined}
          style={[typeStyle('pairsWord', tokens), styles.word, { color: textColor(look) }]}
        />
      </Cell>
    );
  };
  const definitionCell = (place: number) => {
    const cell = definitions[place];
    if (cell === undefined) return null;
    const { shown, state } = cell;
    const look = lookOf(place, judged?.definition, false, state);
    return (
      <Cell
        key={keyOf(place, given?.definition)}
        testID={`pairs-definition-${String(place)}`}
        label={shown}
        look={look}
        turn={CELL_TURN}
        empty={emptyOf(state, look)}
        inert={inertOf(state)}
        half={stay}
        onPress={() => {
          if (selected === undefined) return;
          setSelected(undefined);
          if (stay) setGiven({ word: selected, definition: place, tries: (given?.tries ?? 0) + 1 });
          onAnswer(selected, place);
        }}
      >
        <Text
          maxFontSizeMultiplier={fontScaleCap.text}
          numberOfLines={stay ? DEFINITION_LINES : undefined}
          style={[typeStyle('pairsDefinition', tokens), { color: textColor(look) }]}
        >
          {shown}
        </Text>
      </Cell>
    );
  };

  if (!stay)
    return (
      <View testID="pairs" style={styles.grid}>
        <View style={styles.words}>{words.map((_, place) => wordCell(place))}</View>
        <View style={styles.definitions}>
          {definitions.map((_, place) => definitionCell(place))}
        </View>
      </View>
    );
  const caption = (text: string) => text.toLocaleUpperCase(voice.accessibilityLanguage);
  const captionStyle = [typeStyle('eyebrow', tokens), { color: colors.muted }];
  return (
    <View testID="pairs" style={styles.rows}>
      <View style={styles.row}>
        <Text maxFontSizeMultiplier={fontScaleCap.text} style={[captionStyle, styles.words]}>
          {caption(strings.game.round.pairsCaptions.word)}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap.text} style={[captionStyle, styles.definitions]}>
          {caption(strings.game.round.pairsCaptions.meaning)}
        </Text>
      </View>
      {words.map((_, place) => (
        <View key={place} style={styles.row}>
          <View style={styles.words}>{wordCell(place)}</View>
          <View style={styles.definitions}>{definitionCell(place)}</View>
          <View
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[styles.diamond, { backgroundColor: colors.accent }]}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * A Word or a Definition of the grid on a pressed tile. Its face carries
 * `${testID}-face` and what pops, drops or turns it `${testID}-motion`.
 */
function Cell({
  testID,
  label,
  look,
  turn,
  empty,
  inert,
  half,
  onPress,
  children,
}: {
  testID: string;
  label: string;
  look: Look;
  /** How far a wrong cell turns, in degrees. */
  turn: number;
  /** Whether its pair is answered and its place left empty. */
  empty: boolean;
  /** Whether it takes no tap. */
  inert: boolean;
  /** Whether it is a half of a row's block, in a grid that stays, rather than a tile of its own. */
  half: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const { colors } = useTokens();
  const { voice } = useEdition();
  const motion = useAnswerMotion(look === 'right' || look === 'wrong' ? look : undefined, {
    translateY: pairsGridLayout.cellDrop,
    rotate: turn,
    opacity: WRONG_OPACITY,
  });
  return (
    <View
      accessibilityElementsHidden={empty}
      importantForAccessibility={empty ? 'no-hide-descendants' : 'auto'}
      style={empty && styles.gone}
    >
      <Animated.View testID={`${testID}-motion`} style={motion} {...voice}>
        <PressedTile
          testID={testID}
          tone={TONES[look]}
          radius={pairsGridLayout.cellRadius}
          accessibilityLabel={label}
          accessibilityState={{ selected: look === 'selected', disabled: inert || empty }}
          inert={inert || empty}
          onPress={onPress}
          faceStyle={[
            styles.cell,
            half && styles.half,
            look === 'wrong' && { backgroundColor: colors.surfaceSunken },
          ]}
        >
          {children}
        </PressedTile>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: pairsGridLayout.cellGap },
  // The design's columns, .8 and 1.2 of the width.
  words: { flex: 2, gap: pairsGridLayout.cellGap },
  definitions: { flex: 3, gap: pairsGridLayout.cellGap },
  cell: {
    minHeight: pairsGridLayout.cellHeight,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  gone: { opacity: 0 },
  word: { textAlign: 'center' },
  rows: { gap: pairsGridLayout.cellGap },
  row: { flexDirection: 'row', gap: HALF_GAP },
  half: { minHeight: STAY_CELL_HEIGHT },
  // The small diamond where a row's two halves meet, over the gap between them.
  diamond: {
    position: 'absolute',
    left: '40%',
    top: '50%',
    width: DIAMOND,
    height: DIAMOND,
    marginLeft: -(DIAMOND + HALF_GAP) / 2,
    marginTop: -DIAMOND / 2,
    transform: [{ rotate: '45deg' }],
  },
});
