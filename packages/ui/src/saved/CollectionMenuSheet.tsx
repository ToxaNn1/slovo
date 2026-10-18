import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '../primitives/BottomSheet';
import { SecondaryButton } from '../primitives/SecondaryButton';
import { space } from '../tokens';

/**
 * The menu a Collection's «…» button opens: a bottom sheet with «rename» and
 * «delete» and the cancel row last. A tap on a row asks for its action; the
 * cancel row, a tap on the scrim, a drag on the grabber and VoiceOver's escape
 * gesture ask `onCancel`. The caller turns `visible` off in all three callbacks;
 * `onDismissed` runs once the sheet has slid away.
 */
export function CollectionMenuSheet({
  visible,
  copy,
  onRename,
  onDelete,
  onCancel,
  onDismissed,
  testID = 'collection-menu',
}: {
  visible: boolean;
  copy: { rename: string; delete: string; cancel: string };
  onRename: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onDismissed?: (() => void) | undefined;
  testID?: string;
}) {
  return (
    <BottomSheet visible={visible} onClose={onCancel} onDismissed={onDismissed} testID={testID}>
      <View style={styles.rows}>
        <SecondaryButton label={copy.rename} onPress={onRename} testID={`${testID}-rename`} />
        <SecondaryButton
          label={copy.delete}
          onPress={onDelete}
          destructive
          testID={`${testID}-delete`}
        />
        <SecondaryButton label={copy.cancel} onPress={onCancel} testID={`${testID}-cancel`} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  rows: { gap: space[2] },
});
