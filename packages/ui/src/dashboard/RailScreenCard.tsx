'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { partOfSpeechText, withoutStress, type EntryRowModel } from '@slovo/core';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { entryLabel, entryRowSubtitle } from '../entries/entry-row-text';
import { PressedTile } from '../primitives/PressedTile';
import { useEdition } from '../providers/EditionProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { useTokens } from '../providers/TokensProvider';
import { motion, railScreen as place, typeStyle } from '../tokens';

const RARITY_BARS = [1, 2, 3, 4, 5] as const;
const cascadeEasing = Easing.bezier(...motion.cascade.easing);
const fadeEasing = Easing.bezier(...motion.reduceMotion.easing);

/**
 * One Entry on a Category-style screen (board 05.1), a card as the board
 * draws it: the Lemma with the ink «ЗНАЮ» stamp once it is Known; a Word's
 * Stress and part of speech beside its five rarity bars, or another Entry's
 * label without bars; and its meaning. The cards rise in one after another
 * by `index`; under Reduce Motion each only fades in. A tap opens the Entry.
 */
export function RailScreenCard({
  row,
  known,
  index,
  onPress,
  testID,
}: {
  row: EntryRowModel;
  known: boolean;
  /** The card's place in the list, from 0: it sets when the card rises in. */
  index: number;
  onPress: () => void;
  testID?: string;
}) {
  const shown = useCascade(index);
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const meta =
    row.kind === 'word'
      ? `${row.title} · ${partOfSpeechText(
          strings.wordCard,
          { partOfSpeech: row.partOfSpeech, gender: row.gender },
          'short',
        )}`
      : entryLabel(strings.history.kinds, row);
  return (
    <Animated.View testID={testID && `${testID}-cascade`} style={shown}>
      <PressedTile
        tone="tile"
        depth="action"
        radius={place.card.radius}
        testID={testID}
        accessibilityLabel={[row.spoken, known ? strings.knowledge.known : '']
          .filter((part) => part !== '')
          .join('. ')}
        accessibilityLanguage={voice.accessibilityLanguage}
        onPress={onPress}
        faceStyle={[styles.face, { borderColor: colors.line }]}
      >
        <View style={styles.head}>
          <Text
            {...voice}
            style={[styles.word, typeStyle('railWord', tokens), { color: colors.ink }]}
          >
            {withoutStress(row.title)}
          </Text>
          {known && (
            <View
              testID={testID && `${testID}-known`}
              style={[styles.known, { backgroundColor: colors.ink }]}
            >
              <Text
                {...voice}
                style={[typeStyle('railKnown', tokens), { color: colors.background }]}
              >
                {strings.knowledge.known}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.metaRow}>
          <Text {...voice} style={[typeStyle('railMeta', tokens), { color: colors.muted }]}>
            {meta}
          </Text>
          {row.kind === 'word' && (
            <View style={styles.bars}>
              {RARITY_BARS.map((bar) => (
                <View
                  key={bar}
                  testID={
                    testID && `${testID}-bar-${String(bar)}${bar <= row.rarity ? '-filled' : ''}`
                  }
                  style={[
                    styles.bar,
                    { backgroundColor: bar <= row.rarity ? colors.accent : colors.silhouette },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
        <Text {...voice} style={[typeStyle('railMeaning', tokens), { color: colors.ink }]}>
          {entryRowSubtitle(strings.correctionCard, row)}
        </Text>
      </PressedTile>
    </Animated.View>
  );
}

/** The card's entrance: it rises in after `index` cards, or under Reduce Motion fades in at once. */
function useCascade(index: number) {
  const reduceMotion = useReduceMotion();
  // 1 once the card has entered.
  const entered = useSharedValue(0);
  useEffect(() => {
    entered.value = reduceMotion
      ? withTiming(1, {
          duration: motion.reduceMotion.duration,
          easing: fadeEasing,
          reduceMotion: ReduceMotion.Never,
        })
      : withDelay(
          index * place.cascade.stagger,
          withTiming(1, {
            duration: place.cascade.duration,
            easing: cascadeEasing,
            reduceMotion: ReduceMotion.Never,
          }),
          ReduceMotion.Never,
        );
  }, [entered, index, reduceMotion]);
  return useAnimatedStyle(() => ({
    opacity: entered.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - entered.value) * motion.cascade.rise }],
  }));
}

const styles = StyleSheet.create({
  face: {
    padding: place.card.padding,
    gap: place.card.wordGap,
    borderWidth: StyleSheet.hairlineWidth,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: place.list.wordGap,
  },
  word: { flexShrink: 1 },
  known: {
    paddingHorizontal: place.known.paddingHorizontal,
    paddingVertical: place.known.paddingVertical,
    transform: [{ rotate: place.known.turn }],
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: place.list.wordGap },
  bars: { flexDirection: 'row', gap: place.bars.gap },
  bar: {
    width: place.bars.width,
    height: place.bars.height,
    transform: [{ skewX: place.bars.skew }],
  },
});
