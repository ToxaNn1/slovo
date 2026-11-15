import { StyleSheet, View } from 'react-native';

import { calendarDay } from '../tokens';

/**
 * The frost over a frozen day: diagonal stripes across the tile, as board 10
 * draws it; the Streak freeze card's strip lays it over its frozen day too.
 */
export function Frost() {
  const count = Math.ceil((calendarDay.height * 3) / calendarDay.frost.step);
  return (
    <View style={styles.frost} pointerEvents="none">
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[styles.stripe, { left: index * calendarDay.frost.step - calendarDay.height }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frost: { ...StyleSheet.absoluteFill, overflow: 'hidden', borderRadius: calendarDay.radius },
  stripe: {
    position: 'absolute',
    top: -calendarDay.height,
    width: calendarDay.frost.stripe,
    height: calendarDay.height * 3,
    backgroundColor: calendarDay.frost.color,
    transform: [{ rotate: '45deg' }],
  },
});
