import type { CounterLine } from '@slovo/core';
import { StyleSheet, Text } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { space, typeSize } from '../tokens';

/**
 * The Community Counters line under an Entry card's mark buttons (ADR 0060),
 * e.g. «Знають 3 з 5 читачів · зберегли 0»: the plural form follows the
 * total, and zeros are shown. VoiceOver reads it as one sentence, its two
 * parts joined as the Edition's spoken line says. Without a line, as offline
 * with nothing kept, it draws nothing.
 */
export function CommunityCountersLine({ line }: { line: CounterLine | undefined }) {
  const { strings, voice, count } = useEdition();
  const { colors, fontFamilies } = useTokens();
  if (line === undefined) return null;
  const texts = strings.knowledge.communityCounters;
  const known = fill(count(texts.known, line.total), { known: String(line.known) });
  const saved = fill(texts.saved, { saved: String(line.saved) });
  return (
    <Text
      testID="community-counters"
      accessible
      accessibilityLabel={fill(texts.spokenLine, { known, saved })}
      {...voice}
      style={[styles.line, { color: colors.muted, fontFamily: fontFamilies.ui }]}
    >
      {fill(texts.line, { known, saved })}
    </Text>
  );
}

const styles = StyleSheet.create({
  line: { marginTop: space[2], fontSize: typeSize.meta, textAlign: 'center' },
});
