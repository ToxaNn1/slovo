import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { ConfirmationDialog } from '../primitives/ConfirmationDialog';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { typeSize } from '../tokens';

/**
 * The «Очистити» button of the History screen. A press asks first, with the
 * SLOVO confirmation dialog, and `onClear` runs only when the reader confirms.
 */
export function ClearHistoryButton({
  copy,
  onClear,
  testID,
}: {
  copy: {
    action: string;
    /** What VoiceOver reads for the button. */
    actionLabel: string;
    title: string;
    message: string;
    confirm: string;
    cancel: string;
  };
  onClear: () => void;
  testID?: string | undefined;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const [asking, setAsking] = useState(false);
  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={copy.actionLabel}
        {...voice}
        onPress={() => {
          setAsking(true);
        }}
        style={styles.button}
      >
        <Text style={[styles.text, { color: colors.ink, fontFamily: fontFamilies.ui }]}>
          {copy.action}
        </Text>
      </Pressable>
      <ConfirmationDialog
        visible={asking}
        title={copy.title}
        message={copy.message}
        destructiveLabel={copy.confirm}
        cancelLabel={copy.cancel}
        onDestructive={() => {
          setAsking(false);
          onClear();
        }}
        onCancel={() => {
          setAsking(false);
        }}
        testID={testID === undefined ? undefined : `${testID}-dialog`}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  text: { fontSize: typeSize.blockHeading, fontWeight: '600' },
});
