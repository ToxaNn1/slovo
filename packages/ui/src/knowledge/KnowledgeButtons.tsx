import type { KnowledgeMark } from '@slovo/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { minTouchTarget, outlineButtonRadius, space, typeSize, withAlpha } from '../tokens';

/** How far the largest text sizes of iOS may scale a label, so both buttons stay on one line. */
const LABEL_MAX_FONT_SCALE = 1.2;

/**
 * The «Знаю» and «Не знаю» buttons of an Entry card (ADR 0043): the chosen
 * mark is filled with the accent colour, the other is an outline. A tap calls
 * `onTap` with its mark either way; the Core decides whether that changes the
 * mark or removes it. On a Correction, Known means "I already say it right",
 * and its button says so to a screen reader.
 */
export function KnowledgeButtons({
  entryKind,
  mark,
  onTap,
}: {
  /** The kind of Entry the card shows. */
  entryKind: 'word' | 'correction';
  /** The mark the card shows: none without one, and none while the Entry is due. */
  mark: KnowledgeMark | undefined;
  onTap: (mark: KnowledgeMark) => void;
}) {
  const { strings } = useEdition();
  return (
    <View style={styles.row}>
      <MarkButton
        testID="knowledge-known"
        label={strings.knowledge.known}
        hint={entryKind === 'correction' ? strings.knowledge.correctionKnownHint : undefined}
        selected={mark === 'known'}
        onPress={() => {
          onTap('known');
        }}
      />
      <MarkButton
        testID="knowledge-unknown"
        label={strings.knowledge.unknown}
        selected={mark === 'unknown'}
        onPress={() => {
          onTap('unknown');
        }}
      />
    </View>
  );
}

function MarkButton({
  label,
  hint,
  selected,
  onPress,
  testID,
}: {
  label: string;
  hint?: string | undefined;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected }}
      {...voice}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: selected ? colors.accent : withAlpha(colors.accent, 0.45),
          backgroundColor: selected
            ? colors.accent
            : pressed
              ? colors.surfaceSunken
              : 'transparent',
        },
      ]}
    >
      <Text
        maxFontSizeMultiplier={LABEL_MAX_FONT_SCALE}
        style={[
          styles.label,
          { color: selected ? colors.background : colors.accent, fontFamily: fontFamilies.ui },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: space[3] },
  button: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    paddingHorizontal: space[5],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: outlineButtonRadius,
  },
  label: { fontSize: typeSize.body, fontWeight: '700' },
});
