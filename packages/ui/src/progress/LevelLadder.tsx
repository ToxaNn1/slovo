import { StyleSheet, Text, View } from 'react-native';

import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { collectionMarks, levelLadder, typeStyle } from '../tokens';

/** Where the reader stands on a rung of the ladder. */
export type LadderState = 'passed' | 'current' | 'ahead';

/** One card of the ladder: a Level name, its caption of Levels and its state. */
export interface LevelLadderRung {
  /** The Level name. */
  readonly name: string;
  /** The range of Levels the name covers, such as «Рівні 5–9». */
  readonly caption: string;
  readonly state: LadderState;
}

/**
 * The Profile's Level ladder, as board 10.8: a card per Level name, two to a
 * row, each with a wedge mark, its range of Levels, its name and its state
 * tag, the current one framed and tagged in red; under them an ink bar with
 * the Level and, unless the reader holds the last name, the XP to the next.
 * Each card carries the test ID `${testID}-${index}`, the bar `${testID}-bar`
 * and its line to the next name `${testID}-to-next`.
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
  /** The bar's Level line, such as «РІВЕНЬ 7 · ЧИТАЧ». */
  bar: string;
  /** The bar's line to the next name, such as «ДО ЗНАВЕЦЬ 410 XP»; none under the last name. */
  toNext: string | undefined;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const id = (suffix: string) => (testID === undefined ? undefined : `${testID}-${suffix}`);

  return (
    <View testID={testID} style={styles.ladder}>
      <View style={styles.grid}>
        {rungs.map((rung, index) => {
          const current = rung.state === 'current';
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
                  backgroundColor: colors.tile,
                  borderColor: current ? colors.accent : colors.tileEdge,
                  opacity: rung.state === 'ahead' ? 0.6 : 1,
                },
              ]}
            >
              <Wedge
                points={collectionMarks[index % collectionMarks.length] ?? collectionMarks[0]}
                color={current ? colors.accent : colors.ink}
                width={levelLadder.mark.side}
                height={levelLadder.mark.side}
                style={styles.mark}
              />
              <Text {...voice} style={[typeStyle('meta', tokens), { color: colors.muted }]}>
                {rung.caption}
              </Text>
              <Text
                {...voice}
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[typeStyle('levelName', tokens), { color: colors.ink }]}
              >
                {rung.name}
              </Text>
              <Text
                {...voice}
                style={[
                  typeStyle('soonTag', tokens),
                  { color: current ? colors.accent : colors.muted },
                ]}
              >
                {tags[rung.state]}
              </Text>
            </View>
          );
        })}
      </View>
      <View testID={id('bar')} style={[styles.bar, { backgroundColor: colors.ink }]}>
        <Text {...voice} style={[typeStyle('levelXp', tokens), { color: colors.background }]}>
          {bar}
        </Text>
        {toNext !== undefined && (
          <Text
            {...voice}
            testID={id('to-next')}
            style={[typeStyle('soonTag', tokens), { color: colors.accentText }]}
          >
            {toNext}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ladder: { gap: levelLadder.gap },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: levelLadder.gap },
  card: {
    position: 'relative',
    flexBasis: '45%',
    flexGrow: 1,
    padding: levelLadder.card.padding,
    borderRadius: levelLadder.card.radius,
    borderWidth: levelLadder.card.border,
    gap: levelLadder.card.gap,
    overflow: 'hidden',
  },
  mark: { position: 'absolute', top: levelLadder.mark.top, right: levelLadder.mark.right },
  bar: {
    padding: levelLadder.bar.padding,
    borderRadius: levelLadder.bar.radius,
    gap: levelLadder.bar.gap,
  },
});
