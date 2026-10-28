'use no memo';

import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { onFill, space, typeSize } from '../tokens';

/** The width of each swipe action, from the design. */
const ACTION_WIDTH = 96;
/** How far the text size of iOS may scale an action's label. */
const ACTION_MAX_FONT_SCALE = 1.3;

/** An action a row offers behind a swipe to the left, and to VoiceOver as a custom action. */
export interface RowAction {
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
 * The props that offer a row's actions to VoiceOver as custom actions. Spread
 * them on the row's own element, the one VoiceOver focuses.
 */
export function rowActionProps(actions: readonly RowAction[]) {
  return {
    accessibilityActions: actions.map(({ name, accessibilityLabel }) => ({
      name,
      label: accessibilityLabel,
    })),
    onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => {
      actions.find((action) => action.name === event.nativeEvent.actionName)?.onPress();
    },
  };
}

/**
 * A row whose actions slide out from the right on a swipe to the left, on
 * `react-native-gesture-handler`. The actions are buttons of their own, named
 * `<testID>-<name>`; the row's content offers them to VoiceOver with
 * `rowActionProps`. Needs a `GestureHandlerRootView` above it.
 */
export function SwipeableRow({
  actions,
  containerStyle,
  testID,
  children,
}: {
  actions: readonly RowAction[];
  containerStyle?: StyleProp<ViewStyle>;
  testID: string;
  children: ReactNode;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const swipeable = useRef<SwipeableMethods>(null);
  return (
    <ReanimatedSwipeable
      ref={swipeable}
      testID={testID}
      friction={1.5}
      rightThreshold={ACTION_WIDTH / 2}
      overshootRight={false}
      enabled={actions.length > 0}
      containerStyle={containerStyle}
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
                // A fixed 96 pt action: the label scales a little, then shrinks to fit, never breaking a word.
                maxFontSizeMultiplier={ACTION_MAX_FONT_SCALE}
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  styles.actionLabel,
                  {
                    // White on the destructive fill, as the design draws it.
                    color: action.tone === 'destructive' ? onFill : colors.background,
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
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row' },
  action: { width: ACTION_WIDTH, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: typeSize.caption, fontWeight: '700', paddingHorizontal: space[1] },
});
