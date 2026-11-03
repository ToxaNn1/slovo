import { View, type StyleProp, type ViewStyle } from 'react-native';

/** Keeps Decor out of VoiceOver and out of the way of touches. */
export function DecorView({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={style}
    >
      {children}
    </View>
  );
}
