import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { SheetTitle } from './SheetParts';

/**
 * The bottom sheet of board 09 (XSaved), for the Collection menu, name,
 * delete, share and the Due Quiz: the slanted top with the ink title plate,
 * which wraps a long title, the content, and the cancel button last. The
 * cancel button, a tap on the backdrop, a drag on the top and VoiceOver's
 * escape gesture ask
 * `onClose`; the caller turns `visible` off, and `onDismissed` runs once the
 * sheet has slid away.
 */
export function TitledSheet({
  visible,
  title,
  cancelLabel,
  onClose,
  onDismissed,
  children,
  testID,
}: {
  visible: boolean;
  /** The plate's text, in the Edition's language. */
  title: string;
  /** The cancel button's label, in the Edition's language. */
  cancelLabel: string;
  onClose: () => void;
  onDismissed?: (() => void) | undefined;
  children: ReactNode;
  testID?: string | undefined;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} onDismissed={onDismissed} testID={testID}>
      <SheetTitle>{title}</SheetTitle>
      <View style={styles.content}>{children}</View>
      <Button
        variant="ghost"
        label={cancelLabel}
        onPress={onClose}
        testID={testID === undefined ? undefined : `${testID}-cancel`}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // The board's gap between the plate and what follows, and between the content's parts.
  content: { gap: space[3], marginTop: space[2] },
});
