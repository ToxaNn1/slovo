import type { Mood } from '@slovo/contracts';
import type { MoodBlock } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { PressedTile } from '../primitives/PressedTile';
import { useUndoToast } from '../primitives/UndoToast';
import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { dashboard, moodTile, typeStyle } from '../tokens';
import { BlockTitle } from './BlockTitle';

/**
 * The Mood check-in of the Dashboard, from the board: «Як
 * настрій?» with «Mood дня» at the end, over a tile for each Mood, two to a
 * row (an odd last tile keeps half a row) or three in one row, each with its own red mark. A tap chooses the Mood, or changes it, and
 * a toast says its reply; the chosen tile turns red. While the block carries
 * the chosen Mood's effect, a line under the tiles says it and a
 * tap on the chosen tile unpicks the Mood, with no toast; VoiceOver hints it. It needs an
 * `UndoToastProvider` above it.
 */
export function MoodCheckIn({
  block,
  onChoose,
  onUnpick,
}: {
  block: MoodBlock;
  onChoose: (moodId: string) => void;
  onUnpick: () => void;
}) {
  const tokens = useTokens();
  const { strings, voice } = useEdition();
  const words = strings.dashboard.mood;
  const showToast = useUndoToast();
  const { check } = block;
  const chosenId = check.state === 'chosen' ? check.mood.id : undefined;
  const effect = check.state === 'chosen' ? check.effect : undefined;
  const columns = block.moods.length === 3 ? 3 : moodTile.columns;
  const rows = inRows(
    block.moods.map((mood, index) => ({ mood, index })),
    columns,
  );
  return (
    <View testID="dashboard-mood" style={styles.block}>
      <BlockTitle title={words.question} note={words.note} />
      <View style={styles.grid}>
        {rows.map((row) => (
          <View key={row[0]?.mood.id} style={styles.row}>
            {row.map(({ mood, index }) => (
              <MoodTile
                key={mood.id}
                mood={mood}
                index={index}
                chosen={mood.id === chosenId}
                hint={effect !== undefined && mood.id === chosenId ? words.unpickHint : undefined}
                onPress={() => {
                  if (effect !== undefined && mood.id === chosenId) {
                    onUnpick();
                    return;
                  }
                  onChoose(mood.id);
                  showToast({ message: mood.reply });
                }}
              />
            ))}
            {row.length < columns ? (
              <View testID="dashboard-mood-empty" style={styles.cell} />
            ) : null}
          </View>
        ))}
        {effect !== undefined && (
          <Text
            {...voice}
            testID="dashboard-mood-effect"
            style={[typeStyle('blockNote', tokens), styles.effect, { color: tokens.colors.muted }]}
          >
            {effect}
          </Text>
        )}
      </View>
    </View>
  );
}

/** One Mood's tile: its mark and name, red with the key ink once chosen. */
function MoodTile({
  mood,
  index,
  chosen,
  hint,
  onPress,
}: {
  mood: Mood;
  index: number;
  chosen: boolean;
  hint: string | undefined;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const keyInk = useSchemeColors('light').ink;
  const { voice } = useEdition();
  const ink = chosen ? keyInk : colors.ink;
  const mark = moodTile.marks[index % moodTile.marks.length] ?? moodTile.marks[0];
  return (
    <View style={styles.cell}>
      <PressedTile
        testID={`dashboard-mood-${mood.id}`}
        tone={chosen ? 'accent' : 'tile'}
        depth="action"
        radius={moodTile.radius}
        accessibilityLabel={mood.name}
        accessibilityLanguage={voice.accessibilityLanguage}
        accessibilityHint={hint}
        accessibilityState={{ selected: chosen }}
        faceStyle={styles.face}
        onPress={onPress}
      >
        <Wedge
          points={mark}
          color={chosen ? keyInk : colors.accent}
          width={moodTile.mark.width}
          height={moodTile.mark.height}
        />
        <Text {...voice} style={[typeStyle('moodName', tokens), styles.name, { color: ink }]}>
          {mood.name}
        </Text>
      </PressedTile>
    </View>
  );
}

/** The tiles cut into rows of `columns`. */
function inRows<T>(items: readonly T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += columns)
    rows.push(items.slice(start, start + columns));
  return rows;
}

const styles = StyleSheet.create({
  block: { gap: dashboard.titleGap },
  grid: { gap: moodTile.gap },
  row: { flexDirection: 'row', gap: moodTile.gap },
  cell: { flex: 1 },
  face: {
    height: moodTile.height,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moodTile.markGap,
  },
  // The board's `line-height: 1` centres the glyphs on the line in a browser; on iOS a
  // line height under the font's own drops them below the mark. The font's own line
  // height lets the row centre the glyphs on the mark, as the board does.
  name: { lineHeight: undefined },
  // A long line wraps, so it takes the font's own line height too.
  effect: { lineHeight: undefined },
});
