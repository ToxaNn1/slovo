import { Text } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { Button } from '../primitives/Button';
import { TitledSheet } from '../primitives/TitledSheet';
import { typeStyle } from '../tokens';

/**
 * The question before a Collection is deleted (board 09): the bottom sheet
 * with «Delete «name»?» on the ink plate, the line that says its Entries stay,
 * the red delete button and the cancel button last. It shows while `name` is
 * the Collection being asked about. The cancel button, a tap on the scrim, a
 * drag on its top and VoiceOver's escape gesture ask `onCancel`; the caller
 * clears `name` in both callbacks, and `onDismissed` runs once the sheet has
 * slid away.
 */
export function DeleteCollectionSheet({
  name,
  copy,
  onDelete,
  onCancel,
  onDismissed,
  testID,
}: {
  /** The name of the Collection being asked about; nothing hides the sheet. */
  name: string | undefined;
  copy: {
    /** Takes `{name}`. */
    title: string;
    message: string;
    confirm: string;
    cancel: string;
  };
  onDelete: () => void;
  onCancel: () => void;
  onDismissed?: (() => void) | undefined;
  testID?: string | undefined;
}) {
  const tokens = useTokens();
  const { voice } = useEdition();
  return (
    <TitledSheet
      visible={name !== undefined}
      title={fill(copy.title, { name: name ?? '' })}
      cancelLabel={copy.cancel}
      onClose={onCancel}
      onDismissed={onDismissed}
      testID={testID}
    >
      {name !== undefined && (
        <>
          <Text
            {...voice}
            style={[typeStyle('collectionSheetMessage', tokens), { color: tokens.colors.ink }]}
          >
            {copy.message}
          </Text>
          <Button
            variant="primary"
            label={copy.confirm}
            onPress={onDelete}
            testID={testID === undefined ? undefined : `${testID}-confirm`}
          />
        </>
      )}
    </TitledSheet>
  );
}
