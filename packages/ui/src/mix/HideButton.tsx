import { ActionIcon, ActionTile } from '../primitives/ActionTile';
import { useEdition } from '../providers/EditionProvider';

/** The design's thumb down, on a 24-point grid. */
const HIDE_ICON = {
  outline:
    'M4 4h4v10H4zM8 14l3.5 6.5c1.4 0 2.6-1.1 2.2-2.6L13 15h5.5a2 2 0 0 0 2-2.3l-1.1-6.6A2.5 2.5 0 0 0 16.9 4H8',
};

/**
 * The «Сховати» action of the action row: a thumb down, which opens the
 * hide choice. VoiceOver reads what a tap will do.
 */
export function HideButton({
  onPress,
  testID = 'hide-button',
}: {
  onPress: () => void;
  testID?: string;
}) {
  const { strings } = useEdition();
  return (
    <ActionTile
      label={strings.hiding.tile}
      accessibilityLabel={strings.hiding.button}
      onPress={onPress}
      testID={testID}
      icon={(look) => <ActionIcon paths={HIDE_ICON} look={look} />}
    />
  );
}
