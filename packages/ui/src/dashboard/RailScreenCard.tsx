'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import type { EditionStrings } from '@slovo/contracts';
import { partOfSpeechText, withoutStress, type EntryRowModel } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { entryLabel } from '../entries/entry-row-text';
import { PressedTile } from '../primitives/PressedTile';
import { useCascade, type Cascade } from '../primitives/useCascade';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { railScreen as place, typeStyle } from '../tokens';

const RARITY_BARS = [1, 2, 3, 4, 5] as const;
/** The cards rise in one after another. */
const cascade: Cascade = { variant: 'rise', ...place.cascade };

/**
 * One Entry on a Category-style screen (board 05.1), a card as the board
 * draws it: the Lemma with the ink «ЗНАЮ» stamp once it is Known; a Word's
 * Stress and part of speech beside its five rarity bars, or another Entry's
 * label without bars; and its Definition. A Correction, which the board leaves
 * out, takes the same slots: its non-standard form, its Correction Type's
 * name and its standard forms, « · » between several. The cards rise in one after another
 * by `index`, those from `railScreen.cascadeCap` on together; under Reduce Motion each only fades in. A tap opens the Entry.
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
  const shown = useCascade(Math.min(index, place.cascadeCap), cascade);
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const { title, meta, definition } = cardText(strings, row);
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
            {title}
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
                {strings.dashboard.category.knownStamp}
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
          {definition}
        </Text>
      </PressedTile>
    </Animated.View>
  );
}

/** The texts of a card's three slots: its word, the line of its label and its Definition. */
function cardText(strings: EditionStrings, row: EntryRowModel) {
  if (row.kind === 'word')
    return {
      title: withoutStress(row.title),
      meta: `${row.title} · ${partOfSpeechText(
        strings.wordCard,
        { partOfSpeech: row.partOfSpeech, gender: row.gender },
        'short',
      )}`,
      definition: row.secondLine,
    };
  if (row.kind === 'correction')
    return {
      title: row.secondLine,
      meta: strings.correctionCard.correctionTypes[row.correctionType],
      definition: row.standardForms.join(' · '),
    };
  return {
    title: withoutStress(row.title),
    meta: entryLabel(strings.history.kinds, row),
    definition: row.secondLine,
  };
}

const styles = StyleSheet.create({
  face: {
    padding: place.card.padding,
    gap: place.card.wordGap,
    borderWidth: place.card.line,
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
