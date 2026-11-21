import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { levelLadder, typeStyle } from '../tokens';

/** Where the reader stands on a rung of the ladder. */
export type LadderState = 'passed' | 'current' | 'ahead';

/** One card of the row: a Level name, its range of Levels, its first Level and its state. */
export interface LevelLadderRung {
  /** The Level name. */
  readonly name: string;
  /** The range of Levels the name covers, such as «Рівні 5–9». */
  readonly caption: string;
  /** The first Level of the range, drawn in the card's wedge. */
  readonly first: number;
  readonly state: LadderState;
}

/**
 * The Profile's Levels row (owner decisions 12, 16): a card per Level name in
 * one row, each with the first Level of its range in the Level wedge, its
 * name, its range and its state tag, the current one filled. The Level and
 * the way to the next name are the Level card's, above it, so nothing repeats
 * them under the row. Each card carries the test ID `${testID}-${index}` and
 * its first Level `${testID}-${index}-first`.
 */
export function LevelLadder({
  rungs,
  tags,
  testID,
}: {
  rungs: readonly LevelLadderRung[];
  /** The state tags, such as «ПРОЙДЕНО», «ЗАРАЗ» and «ПОПЕРЕДУ». */
  tags: Readonly<Record<LadderState, string>>;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const id = (suffix: string) => (testID === undefined ? undefined : `${testID}-${suffix}`);
  const { wedge } = levelLadder;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      testID={testID}
      horizontal
      contentContainerStyle={styles.row}
    >
      {rungs.map((rung, index) => {
        const current = rung.state === 'current';
        const text = current ? colors.onAccent : colors.ink;
        const face = {
          passed: { ring: colors.accent, fill: colors.ink, number: colors.accent },
          current: { ring: colors.onAccent, fill: colors.background, number: colors.ink },
          ahead: { ring: colors.silhouette, fill: colors.silhouette, number: colors.muted },
        }[rung.state];
        return (
          <View
            key={rung.caption}
            testID={id(String(index))}
            accessible
            accessibilityLabel={`${rung.caption}, ${rung.name}, ${tags[rung.state]}`}
            {...voice}
            style={[
              styles.card,
              {
                backgroundColor: current ? colors.accent : colors.tile,
                borderColor: current ? colors.accent : colors.tileEdge,
              },
            ]}
          >
            <View style={styles.wedge}>
              <Wedge
                points={wedge.shape}
                color={face.ring}
                width={wedge.width}
                height={wedge.height}
                style={StyleSheet.absoluteFill}
              />
              <Wedge
                points={wedge.shape}
                color={face.fill}
                width={wedge.width * (1 - 2 * wedge.inset)}
                height={wedge.height * (1 - 2 * wedge.inset)}
                style={styles.inset}
              />
              <Text
                testID={id(`${String(index)}-first`)}
                maxFontSizeMultiplier={1}
                style={[typeStyle('ladderNumber', tokens), { color: face.number }]}
              >
                {String(rung.first)}
              </Text>
            </View>
            <Text
              {...voice}
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[typeStyle('ladderName', tokens), { color: text }]}
            >
              {rung.name}
            </Text>
            <Text {...voice} style={[typeStyle('ladderCaption', tokens), { color: text }]}>
              {rung.caption}
            </Text>
            <Text {...voice} style={[typeStyle('soonTag', tokens), { color: text }]}>
              {tags[rung.state]}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: levelLadder.gap },
  card: {
    width: levelLadder.card.width,
    padding: levelLadder.card.padding,
    borderRadius: levelLadder.card.radius,
    borderWidth: levelLadder.card.border,
    gap: levelLadder.card.gap,
  },
  wedge: {
    width: levelLadder.wedge.width,
    height: levelLadder.wedge.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inset: {
    position: 'absolute',
    top: levelLadder.wedge.height * levelLadder.wedge.inset,
    left: levelLadder.wedge.width * levelLadder.wedge.inset,
  },
});
