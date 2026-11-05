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
 * The Mood check-in of the Dashboard (ADR 0076), from the board: «Як
 * настрій?» with «Mood дня» at the end, over a tile for each Mood, two to a
 * row, each with its own red mark. A tap chooses the Mood, or changes it, and
 * a toast says its reply; the chosen tile turns red. It needs an
 * `UndoToastProvider` above it.
 */
export function MoodCheckIn({
  block,
  onChoose,
}: {
  block: MoodBlock;
  onChoose: (moodId: string) => void;
}) {
  const { strings } = useEdition();
  const words = strings.dashboard.mood;
  const showToast = useUndoToast();
  const { check } = block;
  const chosenId = check.state === 'chosen' ? check.mood.id : undefined;
  const rows = inRows(block.moods.map((mood, index) => ({ mood, index })));
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
                onPress={() => {
                  onChoose(mood.id);
                  showToast({ message: mood.reply });
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/** One Mood's tile: its mark and name, red with the key ink once chosen. */
function MoodTile({
  mood,
  index,
  chosen,
  onPress,
}: {
  mood: Mood;
  index: number;
  chosen: boolean;
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
        <Text {...voice} style={[typeStyle('moodName', tokens), { color: ink }]}>
          {mood.name}
        </Text>
      </PressedTile>
    </View>
  );
}

/** The tiles cut into rows of `moodTile.columns`. */
function inRows<T>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += moodTile.columns)
    rows.push(items.slice(start, start + moodTile.columns));
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
});
