import { Pressable, StyleSheet, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { dashboard } from '../tokens';
import { BlockTitle } from './BlockTitle';

/**
 * A rail's header on the Dashboard: its title and count as a block title.
 * Given `onPress`, the header is a button, read as «title, count», that opens
 * the screen of all the rail's tiles; without, a plain title.
 */
export function RailHeader({
  title,
  note,
  testID,
  onPress,
}: {
  title: string;
  note: string;
  testID: string;
  onPress?: (() => void) | undefined;
}) {
  const { voice } = useEdition();
  if (onPress === undefined)
    return (
      <View style={styles.title}>
        <BlockTitle title={title} note={note} testID={testID} />
      </View>
    );
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${note}`}
      accessibilityLanguage={voice.accessibilityLanguage}
      onPress={onPress}
      hitSlop={{ top: dashboard.titleSlop }}
      style={styles.title}
    >
      <View pointerEvents="none">
        <BlockTitle title={title} note={note} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: dashboard.side, paddingBottom: dashboard.titleGap },
});
