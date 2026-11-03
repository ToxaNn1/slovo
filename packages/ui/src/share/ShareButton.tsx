import { ActionIcon, ActionTile } from '../primitives/ActionTile';
import { useEdition } from '../providers/EditionProvider';

/** The design's arrow up out of an open tray, on a 24-point grid. */
const SHARE_ICON = { outline: 'M12 3v12M7.5 7.5 12 3l4.5 4.5', inner: 'M5 12v8h14v-8' };

/**
 * The «Поділитися» action of the action row: an arrow up out of a tray,
 * which opens the sheet with the Share Card. VoiceOver reads what a tap
 * will do.
 */
export function ShareButton({
  onPress,
  testID = 'share-button',
}: {
  onPress: () => void;
  testID?: string;
}) {
  const { strings } = useEdition();
  return (
    <ActionTile
      label={strings.share.button}
      accessibilityLabel={strings.share.button}
      onPress={onPress}
      testID={testID}
      icon={(look) => <ActionIcon paths={SHARE_ICON} look={look} />}
    />
  );
}
