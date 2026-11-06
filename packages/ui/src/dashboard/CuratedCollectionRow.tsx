import { partOfSpeechText, withoutStress, type EntryRowModel } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { entryLabel, entryRowSubtitle } from '../entries/entry-row-text';
import { PressedTile } from '../primitives/PressedTile';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { railScreen as place, typeStyle } from '../tokens';

const RARITY_BARS = [1, 2, 3, 4, 5] as const;

/**
 * One Entry on a Curated Collection's screen, a cream card as the board
 * draws it: the Lemma with the ink «ЗНАЮ» stamp once it is Known; a Word's
 * Stress and part of speech beside its rarity bars, or another Entry's
 * label; and its Definition. A tap opens the Entry.
 */
export function CuratedCollectionRow({
  row,
  known,
  onPress,
  testID,
}: {
  row: EntryRowModel;
  known: boolean;
  onPress: () => void;
  testID?: string;
}) {
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
            <Text {...voice} style={[typeStyle('railKnown', tokens), { color: colors.background }]}>
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
  );
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
