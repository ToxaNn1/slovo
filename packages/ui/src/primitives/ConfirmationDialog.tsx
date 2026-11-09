import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { fontScaleCap, space, typeStyle } from '../tokens';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { SheetTitle } from './SheetParts';

/**
 * The SLOVO confirmation dialog, which stands in for the system's alerts and
 * action sheets: the design's bottom sheet with the title, an optional
 * message, the destructive action in red and the cancel action under it. A tap
 * on the scrim, a drag on its top, the system back gesture and VoiceOver's
 * escape gesture all ask `onCancel`. It is a single destructive confirmation;
 * a choice between actions is a `BottomSheet`. It draws nothing while
 * `visible` is false, and the caller turns `visible` off in both callbacks.
 */
export function ConfirmationDialog({
  visible,
  title,
  message,
  destructiveLabel,
  cancelLabel,
  onDestructive,
  onCancel,
  testID,
}: {
  visible: boolean;
  title: string;
  message?: string | undefined;
  /** The label of the destructive action, a verb such as «Видалити». */
  destructiveLabel: string;
  cancelLabel: string;
  onDestructive: () => void;
  onCancel: () => void;
  testID?: string | undefined;
}) {
  const tokens = useTokens();
  const { voice } = useEdition();
  const id = (suffix: string) => (testID === undefined ? undefined : `${testID}-${suffix}`);
  return (
    <BottomSheet visible={visible} onClose={onCancel} testID={testID}>
      <SheetTitle>{title}</SheetTitle>
      {message !== undefined && (
        <Text
          {...voice}
          maxFontSizeMultiplier={fontScaleCap.number}
          style={[typeStyle('sub', tokens), { color: tokens.colors.ink }]}
          testID={id('message')}
        >
          {message}
        </Text>
      )}
      <View style={styles.actions}>
        <Button label={destructiveLabel} onPress={onDestructive} testID={id('destructive')} />
        <Button variant="neutral" label={cancelLabel} onPress={onCancel} testID={id('cancel')} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: { gap: space[3] },
});
