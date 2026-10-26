import type { AnyEntryCard, KnowledgeMark } from '@slovo/core';
import { StyleSheet, View } from 'react-native';

import { useConcealed } from '../entries/self-check';
import { OutlineButton } from '../primitives/OutlineButton';
import { useEdition } from '../providers/EditionProvider';
import { space } from '../tokens';

/**
 * The «Знаю» and «Не знаю» buttons of an Entry card (ADR 0043): the chosen
 * mark is filled with the accent colour, the other is an outline. A tap calls
 * `onTap` with its mark either way; the Core decides whether that changes the
 * mark or removes it. On a Correction, Known means "I already say it right",
 * and its button says so to a screen reader. While Self-check conceals the
 * meaning of the Entry card they are under, both buttons are inactive.
 */
export function KnowledgeButtons({
  entryKind,
  mark,
  onTap,
}: {
  /** The kind of Entry the card shows. */
  entryKind: AnyEntryCard['kind'];
  /** The mark the card shows: none without one, and none while the Entry is due. */
  mark: KnowledgeMark | undefined;
  onTap: (mark: KnowledgeMark) => void;
}) {
  const { strings } = useEdition();
  // Nothing can be marked until the reader reveals what Self-check conceals.
  const inactive = useConcealed();
  return (
    <View style={styles.row}>
      <OutlineButton
        testID="knowledge-known"
        label={strings.knowledge.known}
        accessibilityHint={
          entryKind === 'correction' ? strings.knowledge.correctionKnownHint : undefined
        }
        selected={mark === 'known'}
        disabled={inactive}
        paired
        onPress={() => {
          onTap('known');
        }}
      />
      <OutlineButton
        testID="knowledge-unknown"
        label={strings.knowledge.unknown}
        selected={mark === 'unknown'}
        disabled={inactive}
        paired
        onPress={() => {
          onTap('unknown');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: space[3] },
});
