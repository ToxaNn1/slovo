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

/** The line to the next name under the row and how much of the way is behind. */
export interface LevelLadderToNext {
  /** Such as «ЗНАВЕЦЬ: ЩЕ 410 XP». */
  readonly text: string;
  /** The share, from 0 to 1, of the XP from the name's first Level to the next name's. */
  readonly share: number;
}

/**
 * The Profile's Levels row (owner decisions 12, 16): a card per Level name in
 * one row, each with the first Level of its range in the Level wedge, its
 * name, its range and its state tag, the current one filled; under the row
 * the Level line and, unless the reader holds the last name, the line to the
 * next name over a slanted bar of the way behind. Each card carries the test
 * ID `${testID}-${index}` and its first Level `${testID}-${index}-first`, the
 * lines `${testID}-bar` and the line to the next name `${testID}-to-next`.
 */
export function LevelLadder({
  rungs,
  tags,
  bar,
  toNext,
  testID,
}: {
  rungs: readonly LevelLadderRung[];
  /** The state tags, such as «ПРОЙДЕНО», «ЗАРАЗ» and «ПОПЕРЕДУ». */
  tags: Readonly<Record<LadderState, string>>;
  /** The Level line, such as «РІВЕНЬ 7 · ЧИТАЧ». */
  bar: string;
  /** The line to the next name; none under the last name. */
  toNext: LevelLadderToNext | undefined;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const id = (suffix: string) => (testID === undefined ? undefined : `${testID}-${suffix}`);
  const { wedge } = levelLadder;

  return (
    <View testID={testID} style={styles.ladder}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
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
      <View testID={id('bar')} style={styles.lines}>
        <Text {...voice} style={[typeStyle('ladderLine', tokens), { color: colors.ink }]}>
          {bar}
        </Text>
        {toNext !== undefined && (
          <Text
            {...voice}
            testID={id('to-next')}
            style={[typeStyle('ladderLine', tokens), { color: colors.muted }]}
          >
            {toNext.text}
          </Text>
        )}
      </View>
      {toNext !== undefined && (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.track, { backgroundColor: colors.silhouette }]}
        >
          <View
            style={[
              styles.filled,
              {
                backgroundColor: colors.accent,
                width: `${String(Math.min(Math.max(0, toNext.share), 1) * 100)}%`,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ladder: { gap: levelLadder.bar.gap },
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
  lines: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: levelLadder.gap,
  },
  track: {
    height: levelLadder.bar.height,
    overflow: 'hidden',
    transform: [{ skewX: `${String(levelLadder.bar.skew)}deg` }],
  },
  filled: { height: '100%' },
});
