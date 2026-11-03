import { useConcealed } from '../entries/self-check';
import { ActionIcon, ActionTile } from '../primitives/ActionTile';
import { useEdition } from '../providers/EditionProvider';

/** The design's flag: its pole and a notched pennant, on a 24-point grid. */
const FLAG_ICON = { outline: 'M5 21V4', inner: 'M5 4h12l-2.5 4.5L17 13H5' };

/**
 * The «Помилка» action of the action row: a flag, which opens the sheet of
 * a Mistake Report. While Self-check conceals the meaning of the Entry card
 * it is under, there is nothing to report yet, so it is disabled. VoiceOver
 * reads what a tap will do.
 */
export function MistakeReportButton({
  onPress,
  testID = 'mistake-report-button',
}: {
  onPress: () => void;
  testID?: string;
}) {
  const { strings } = useEdition();
  const concealed = useConcealed();
  return (
    <ActionTile
      label={strings.mistakeReport.tile}
      accessibilityLabel={strings.mistakeReport.action}
      disabled={concealed}
      onPress={onPress}
      testID={testID}
      icon={(look) => <ActionIcon paths={FLAG_ICON} look={look} />}
    />
  );
}
