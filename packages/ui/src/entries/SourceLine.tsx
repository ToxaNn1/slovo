import { WholeLinesText } from '../primitives/WholeLines';
import { fill, useEdition } from '../providers/EditionProvider';
import { typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** What sits between the titles of an Entry's sources on its source line. */
const SOURCE_SEPARATOR = '; ';

/**
 * The line naming an Entry's sources in the kind's `template` (its
 * `{source}`), or nothing when it has none.
 */
export function SourceLine({
  testID,
  template,
  sourceNames,
}: {
  testID: string;
  template: string;
  sourceNames: readonly string[];
}) {
  const tokens = useTokens();
  const { voice } = useEdition();
  return sourceNames.length === 0 ? null : (
    <WholeLinesText
      testID={testID}
      {...voice}
      style={[typeStyle('meta', tokens), { color: tokens.colors.muted }]}
    >
      {fill(template, { source: sourceNames.join(SOURCE_SEPARATOR) })}
    </WholeLinesText>
  );
}
