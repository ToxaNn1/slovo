import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { scrimColor, space, typeSize } from '../tokens';
import { SecondaryButton } from './SecondaryButton';
import { SheetTitle } from './SheetParts';

/** The widest the dialog grows, so it stays a card in the middle of a wide screen. */
const MAX_WIDTH = 360;

/** How far the largest text sizes of iOS may scale the message, so the dialog stays on the screen. */
const MESSAGE_MAX_FONT_SCALE = 1.3;

/**
 * The SLOVO confirmation dialog, which stands in for the system's alerts and
 * action sheets: a card in the middle of the screen over a scrim, with a
 * title, an optional message, the destructive action first and the cancel
 * action under it. A tap on the scrim, the system back gesture and
 * VoiceOver's escape gesture all ask `onCancel`. It is a single destructive
 * confirmation; a choice between actions is a `BottomSheet`. It draws nothing
 * while `visible` is false, and the caller turns `visible` off in both
 * callbacks.
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
  const { colors, colorScheme, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  if (!visible) return null;
  const id = (suffix: string) => (testID === undefined ? undefined : `${testID}-${suffix}`);
  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      supportedOrientations={['portrait']}
    >
      <View style={styles.root} testID={testID}>
        <Pressable
          // The scrim is no control for VoiceOver: the dialog closes with its cancel action.
          accessible={false}
          onPress={onCancel}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: scrimColor(colors.ink, colorScheme) },
          ]}
          testID={id('scrim')}
        />
        <View
          accessibilityViewIsModal
          onAccessibilityEscape={onCancel}
          style={[
            styles.panel,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              borderRadius: radii.card,
            },
          ]}
          testID={id('panel')}
        >
          <SheetTitle>{title}</SheetTitle>
          {message !== undefined && (
            <Text
              {...voice}
              maxFontSizeMultiplier={MESSAGE_MAX_FONT_SCALE}
              style={[styles.message, { color: colors.muted, fontFamily: fontFamilies.ui }]}
              testID={id('message')}
            >
              {message}
            </Text>
          )}
          <View style={styles.actions}>
            <SecondaryButton
              destructive
              label={destructiveLabel}
              onPress={onDestructive}
              testID={id('destructive')}
            />
            <SecondaryButton label={cancelLabel} onPress={onCancel} testID={id('cancel')} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[5] },
  panel: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    borderWidth: 1,
    padding: space[5],
    gap: space[3],
  },
  message: { fontSize: typeSize.body },
  actions: { marginTop: space[3], gap: space[2] },
});
