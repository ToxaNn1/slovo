'use no memo';

import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { fontScaleCap, onFill, space, swipeActionWidth, typeStyle } from '../tokens';

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
 * The props that offer a row's or a card's actions to VoiceOver as custom
 * actions. Spread them on the element VoiceOver focuses.
 */
export function rowActionProps(
  actions: readonly Pick<RowAction, 'name' | 'accessibilityLabel' | 'onPress'>[],
) {
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
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const swipeable = useRef<SwipeableMethods>(null);
  return (
    <ReanimatedSwipeable
      ref={swipeable}
      testID={testID}
      friction={1.5}
      rightThreshold={swipeActionWidth / 2}
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
                maxFontSizeMultiplier={fontScaleCap.number}
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  typeStyle('swipeAction', tokens),
                  styles.actionLabel,
                  {
                    // White on the destructive fill, as the design draws it.
                    color: action.tone === 'destructive' ? onFill : colors.background,
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
  action: { width: swipeActionWidth, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { paddingHorizontal: space[1] },
});
