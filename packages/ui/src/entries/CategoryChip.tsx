import { StyleSheet, Text, View } from 'react-native';

import { fill as fillIn, useEdition } from '../providers/EditionProvider';
import { useWholeBlock } from '../primitives/WholeLines';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { space, typeStyle, withAlpha, wordCardControls, wordHero } from '../tokens';
import { capitalised } from './capitalised';
import { useOnAccent } from './on-accent';

/**
 * The chip naming an Entry's Category on its card, filled where the chips of
 * the Correction Type and register are outlined. VoiceOver reads it as the
 * Category, in the Edition's language. On the red ground it is cream, see-through.
 * Clamped content shows it whole or not at all, never a sliver of its box (ADR 0091).
 */
export function CategoryChip({ testID, name }: { testID: string; name: string }) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice, strings } = useEdition();
  const key = useSchemeColors('light');
  const onAccent = useOnAccent();
  const fill = onAccent ? withAlpha(key.background, wordHero.chipFill) : colors.surfaceSunken;
  const whole = useWholeBlock();
  return (
    <View
      {...whole}
      testID={testID}
      accessible
      accessibilityLabel={fillIn(strings.wordCard.category, { category: name })}
      {...voice}
      style={[styles.chip, { backgroundColor: fill, borderRadius: radii.chip }]}
    >
      <Text style={[typeStyle('categoryChip', tokens), { color: onAccent ? key.ink : colors.ink }]}>
        {capitalised(name, voice.accessibilityLanguage)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    paddingHorizontal: space[3],
    paddingVertical: wordCardControls.chipPaddingVertical,
  },
});
