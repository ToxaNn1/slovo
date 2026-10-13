import type { EntryRowModel } from '@slovo/core';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { fill, useEdition } from './EditionProvider';
import { space } from './tokens';
import { useTokens } from './TokensProvider';

/** The width of each swipe action, from the design. */
const ACTION_WIDTH = 96;

/** An action a row offers behind a swipe to the left, and to VoiceOver as a custom action. */
export interface EntryRowAction {
  /** What the action is called in code, unique within the row. */
  readonly name: string;
  /** The text on the action, such as «Видалити». */
  readonly label: string;
  /** What VoiceOver reads for it, such as «Видалити «шпаркий»». */
  readonly accessibilityLabel: string;
  /** Destructive actions sit on the destructive colour, the others on the muted one. */
  readonly tone: 'destructive' | 'muted';
  readonly onPress: () => void;
}

/**
 * One Entry in a list (Favorites, and later Collections and History), built
 * from the Core's row model: a Word's Lemma with its Stress over its
 * Definition on one line, or a Correction's standard equivalent over the
 * non-standard form it replaces. The trailing text is what the screen puts
 * on the right (a date, a kind, a time). A tap opens the Entry; the actions
 * slide out from the right and are VoiceOver actions too. Needs a
 * `GestureHandlerRootView` above it.
 */
export function EntryRow({
  row,
  trailing,
  onPress,
  actions = [],
  testID = `entry-row-${row.entryId}`,
}: {
  row: EntryRowModel;
  trailing?: string;
  onPress: () => void;
  actions?: readonly EntryRowAction[];
  testID?: string;
}) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
  const swipeable = useRef<SwipeableMethods>(null);
  const subtitle =
    row.kind === 'word'
      ? row.definition
      : fill(strings.correctionCard.insteadOf, { form: row.nonStandardForm });

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      testID={testID}
      friction={1.5}
      rightThreshold={ACTION_WIDTH / 2}
      overshootRight={false}
      enabled={actions.length > 0}
      containerStyle={[styles.container, { borderColor: colors.line }]}
      renderRightActions={() => (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.name}
              testID={`${testID}-${action.name}`}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel}
              {...voice}
              onPress={() => {
                swipeable.current?.close();
                action.onPress();
              }}
              style={[
                styles.action,
                {
                  backgroundColor:
                    action.tone === 'destructive' ? colors.destructive : colors.muted,
                },
              ]}
            >
              <Text
                style={[
                  styles.actionLabel,
                  {
                    // White on the destructive fill, as the design draws it.
                    color: action.tone === 'destructive' ? '#FFFFFF' : colors.background,
                    fontFamily: fontFamilies.ui,
                  },
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    >
      <Pressable
        testID={`${testID}-open`}
        accessibilityRole="button"
        accessibilityLabel={[row.title, subtitle, trailing].filter(Boolean).join(', ')}
        accessibilityActions={actions.map(({ name, accessibilityLabel }) => ({
          name,
          label: accessibilityLabel,
        }))}
        onAccessibilityAction={(event) => {
          actions.find((action) => action.name === event.nativeEvent.actionName)?.onPress();
        }}
        {...voice}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: pressed ? colors.surfaceSunken : colors.background },
        ]}
      >
        <View style={styles.titleLine}>
          <Text style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}>
            {row.title}
          </Text>
          {trailing !== undefined && (
            <Text style={[styles.trailing, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
              {trailing}
            </Text>
          )}
        </View>
        <Text
          style={[styles.subtitle, { color: colors.inkSecondary, fontFamily: fontFamilies.ui }]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  container: { borderBottomWidth: 1 },
  row: { minHeight: 60, paddingVertical: 14, paddingHorizontal: space[6], gap: 3 },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: { flexShrink: 1, fontSize: 22, fontWeight: '500' },
  trailing: { flexShrink: 0, fontSize: 12, fontWeight: '500' },
  subtitle: { fontSize: 14, lineHeight: 14 * 1.4 },
  actions: { flexDirection: 'row' },
  action: { width: ACTION_WIDTH, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 14, fontWeight: '700' },
});
