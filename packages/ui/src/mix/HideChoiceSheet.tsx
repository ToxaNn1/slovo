import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '../primitives/BottomSheet';
import { SecondaryButton } from '../primitives/SecondaryButton';
import { space } from '../tokens';

/**
 * The hide choice a card's hide button opens: a bottom sheet with a row per
 * way to hide, in the order given, and the cancel row last. A tap on a row asks
 * `onChoose` with its key; the cancel row, a tap on the scrim, a drag on the
 * grabber and VoiceOver's escape gesture ask `onCancel`. The caller turns
 * `visible` off in both callbacks.
 */
export function HideChoiceSheet({
  visible,
  options,
  cancelLabel,
  onChoose,
  onCancel,
  testID = 'hide-choice',
}: {
  visible: boolean;
  /** What the reader can hide, each with a key `onChoose` gets back. */
  options: readonly { readonly key: string; readonly label: string }[];
  cancelLabel: string;
  onChoose: (key: string) => void;
  onCancel: () => void;
  testID?: string;
}) {
  return (
    <BottomSheet visible={visible} onClose={onCancel} testID={testID}>
      <View style={styles.rows}>
        {options.map(({ key, label }) => (
          <SecondaryButton
            key={key}
            label={label}
            onPress={() => {
              onChoose(key);
            }}
            testID={`${testID}-${key}`}
          />
        ))}
        <SecondaryButton label={cancelLabel} onPress={onCancel} testID={`${testID}-cancel`} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  rows: { gap: space[2] },
});
