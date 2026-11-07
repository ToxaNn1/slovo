import { sentences } from '@slovo/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { crosswordDayCard, pressedFade, typeStyle } from '../tokens';

/** How far the largest text sizes of iOS may scale the card's text, so it never breaks a word. */
const TEXT_MAX_FONT_SCALE = 1.3;

/**
 * How far today's crossing Daily Crossword has come, as its card draws it:
 * not started, with its size and count of Words and «Почати»; started, with
 * the Words solved of all and «Продовжити»; or solved, with its small grid,
 * the solved mark and the time line, if the record has a time.
 */
export type CrosswordDayCardState =
  | { readonly kind: 'start'; readonly line: string; readonly action: string }
  | {
      readonly kind: 'resume';
      readonly action: string;
      readonly solved: number;
      readonly total: number;
    }
  | {
      readonly kind: 'solved';
      readonly mark: string;
      readonly result: string | undefined;
      /** The small grid by row and column: `true` for a cell a Word reads through, `false` for a block. */
      readonly grid: readonly (readonly boolean[])[];
    };

/**
 * The crossing Daily Crossword's card on the hub, board 08's three states
 * (ADR 0087): a card with the name and day, then the size line and a red
 * «Почати», or a slanted bar of the Words solved and an ink «Продовжити»;
 * once solved, an ink card with its grid of red cells, «✓ Розв’язано» and the
 * time line. A tap anywhere on it opens the crossword's screen, and VoiceOver
 * reads it as one button. The solved grid's cells carry the test ID
 * `${testID}-cell-${row}-${column}`, or `-block-` where no Word reads through.
 */
export function CrosswordDayCard({
  title,
  state,
  onPress,
  testID,
}: {
  /** Its name with the day, such as «Кросворд дня · 2 листопада». */
  title: string;
  state: CrosswordDayCardState;
  /** Opens the crossword's screen. */
  onPress: () => void;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const keyInk = useSchemeColors('light').ink;
  const { voice } = useEdition();
  const solved = state.kind === 'solved';
  const label =
    state.kind === 'start'
      ? sentences([title, state.line, state.action])
      : state.kind === 'resume'
        ? sentences([title, state.action])
        : sentences([title, state.mark, state.result]);
  const titleText = (
    <Text
      maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
      style={[
        typeStyle('crosswordCardTitle', tokens),
        { color: solved ? colors.background : colors.ink },
      ]}
    >
      {title}
    </Text>
  );
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(state.kind === 'resume'
        ? { accessibilityValue: { min: 0, max: state.total, now: state.solved } }
        : {})}
      {...voice}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderRadius: tokens.radii.card, opacity: pressed ? pressedFade : 1 },
        solved
          ? { backgroundColor: colors.ink, borderColor: colors.ink }
          : { backgroundColor: colors.surface, borderColor: colors.line },
      ]}
    >
      {state.kind === 'solved' ? (
        <View style={styles.solved}>
          {titleText}
          <View style={styles.solvedBody}>
            <View style={styles.grid}>
              {state.grid.map((cells, row) => (
                <View key={row} style={styles.gridRow}>
                  {cells.map((cell, column) => (
                    <View
                      key={column}
                      testID={
                        testID === undefined
                          ? undefined
                          : `${testID}-${cell ? 'cell' : 'block'}-${String(row)}-${String(column)}`
                      }
                      style={[
                        styles.cell,
                        cell
                          ? { backgroundColor: colors.accent }
                          : {
                              backgroundColor: colors.background,
                              opacity: crosswordDayCard.blockOpacity,
                            },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
            <View style={styles.lines}>
              <Text
                maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
                style={[typeStyle('crosswordCardMark', tokens), { color: colors.accent }]}
              >
                {state.mark}
              </Text>
              {state.result === undefined ? null : (
                <Text
                  maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
                  style={[
                    typeStyle('crosswordCardLine', tokens),
                    styles.result,
                    { color: colors.background },
                  ]}
                >
                  {state.result}
                </Text>
              )}
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <View style={[styles.lines, state.kind === 'resume' && styles.barLines]}>
            {titleText}
            {state.kind === 'start' ? (
              <Text
                maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
                style={[typeStyle('crosswordCardLine', tokens), { color: colors.muted }]}
              >
                {state.line}
              </Text>
            ) : (
              <View style={[styles.bar, { backgroundColor: colors.silhouette }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      backgroundColor: colors.ink,
                      width: `${String((100 * state.solved) / Math.max(state.total, 1))}%`,
                    },
                  ]}
                />
              </View>
            )}
          </View>
          <View
            style={[
              styles.button,
              { borderRadius: tokens.radii.button },
              state.kind === 'start'
                ? {
                    backgroundColor: colors.accent,
                    borderBottomColor: colors.accentEdge,
                    borderBottomWidth: crosswordDayCard.button.depth,
                  }
                : { backgroundColor: colors.ink },
            ]}
          >
            <Text
              maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
              style={[
                typeStyle('crosswordState', tokens),
                { color: state.kind === 'start' ? keyInk : colors.background },
              ]}
            >
              {state.action}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const { mini, button, bar } = crosswordDayCard;

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: crosswordDayCard.padding },
  row: { flexDirection: 'row', alignItems: 'center', gap: crosswordDayCard.gap },
  lines: { flex: 1, minWidth: 0, gap: crosswordDayCard.lineGap },
  barLines: { gap: crosswordDayCard.barGap },
  bar: { height: bar.height, transform: [{ skewX: bar.skew }] },
  barFill: { height: '100%' },
  button: {
    flex: 0,
    height: button.height,
    paddingHorizontal: button.paddingHorizontal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solved: { gap: crosswordDayCard.gap },
  solvedBody: { flexDirection: 'row', alignItems: 'center', gap: crosswordDayCard.solvedGap },
  grid: { gap: mini.gap },
  gridRow: { flexDirection: 'row', gap: mini.gap },
  cell: { width: mini.cell, height: mini.cell, borderRadius: mini.radius },
  result: { opacity: crosswordDayCard.resultOpacity },
});
