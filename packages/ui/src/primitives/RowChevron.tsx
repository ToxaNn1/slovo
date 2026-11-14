import { useTokens } from '../providers/TokensProvider';
import { settingsRowDrawing, wedges } from '../tokens';
import { Wedge } from './Wedge';

/**
 * The design's slanted chevron that ends a row which opens a screen: a
 * settings row, and a row of a Collection (board 09) in the ink and larger.
 * VoiceOver skips it.
 */
export function RowChevron({
  tone = 'muted',
  size = { width: settingsRowDrawing.chevronWidth, height: settingsRowDrawing.chevronHeight },
}: {
  tone?: 'muted' | 'ink';
  size?: { readonly width: number; readonly height: number };
}) {
  const { colors } = useTokens();
  return (
    <Wedge points={wedges.chevron} color={colors[tone]} width={size.width} height={size.height} />
  );
}
