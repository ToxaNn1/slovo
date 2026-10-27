import { ScrollView, StyleSheet } from 'react-native';

import { BottomSheet } from '../primitives/BottomSheet';
import { PrimaryButton } from '../primitives/PrimaryButton';
import { SheetTitle } from '../primitives/SheetParts';
import { space } from '../tokens';
import { WidgetGuide } from './WidgetGuide';

/**
 * The widget hint: the widget guide in a bottom sheet under its title, and a
 * button that closes it. The button, a tap on the scrim, a drag on the grabber
 * and VoiceOver's escape gesture ask `onClose`; the caller turns `visible`
 * off. The guide scrolls on a small screen.
 */
export function WidgetGuideSheet({
  visible,
  title,
  closeLabel,
  onClose,
  testID = 'widget-guide-sheet',
  ...guide
}: {
  visible: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  testID?: string;
} & Omit<Parameters<typeof WidgetGuide>[0], 'testID'>) {
  return (
    <BottomSheet visible={visible} onClose={onClose} testID={testID}>
      <ScrollView bounces={false} style={styles.scroll} contentContainerStyle={styles.content}>
        <SheetTitle>{title}</SheetTitle>
        <WidgetGuide {...guide} testID={testID} />
      </ScrollView>
      <PrimaryButton testID={`${testID}-close`} label={closeLabel} onPress={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { gap: space[4], paddingBottom: space[4] },
});
