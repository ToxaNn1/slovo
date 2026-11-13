import { withoutStress } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { capitalised } from './capitalised';
import { useWholeBlock } from '../primitives/WholeLines';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { linkChip, space, typeStyle } from '../tokens';

/**
 * Words in raised chips that wrap to the next line (boards p1 «Зв’язки»,
 * XEntry2 e9 «Правило»): each a tile outlined in the line colour, its edge
 * `linkChip.depth` below it. VoiceOver reads each word without its Stress
 * mark. Each chip is `<testID>-<word>`, or `<testID>-<index>` with `byIndex`.
 */
export function LinkChips({
  testID,
  words,
  byIndex = false,
}: {
  testID: string;
  words: readonly string[];
  byIndex?: boolean;
}) {
  return (
    <View style={styles.chips}>
      {words.map((word, index) => (
        <LinkChip
          key={`${String(index)}-${word}`}
          testID={`${testID}-${byIndex ? String(index) : word}`}
          word={word}
        />
      ))}
    </View>
  );
}

/** One chip, shown whole or not at all where its tab is clamped (ADR 0091). */
function LinkChip({ testID, word }: { testID: string; word: string }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const block = useWholeBlock(linkChip.depth);
  return (
    <View
      {...block}
      testID={testID}
      accessible
      accessibilityLabel={withoutStress(word)}
      {...voice}
      style={[
        styles.chip,
        {
          backgroundColor: colors.tile,
          borderColor: colors.line,
          boxShadow: [
            { offsetX: 0, offsetY: linkChip.depth, blurRadius: 0, color: colors.tileEdge },
          ],
        },
      ]}
    >
      <Text style={[typeStyle('linkChip', tokens), { color: colors.ink }]}>
        {capitalised(word, voice.accessibilityLanguage)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    paddingHorizontal: linkChip.padding.horizontal,
    paddingVertical: linkChip.padding.vertical,
    borderRadius: linkChip.radius,
    borderWidth: 1,
  },
});
