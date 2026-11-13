import { useState } from 'react';
import { Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../primitives/Icon';
import { useEdition } from '../providers/EditionProvider';
import { pressedFade, railScreen } from '../tokens';

/**
 * The room of a Category-style screen's hero: `shift`, how far the safe area
 * pushes it down past the board's status bar, and its `height`, the board's
 * `boardHeight` or more when a long title or description needs it, which
 * `onLayout` keeps.
 */
export function useHeroRoom(boardHeight: number) {
  // The board measures from the screen's top under its status bar.
  const shift = Math.max(0, useSafeAreaInsets().top - railScreen.statusBar);
  const [height, setHeight] = useState(boardHeight + shift);
  return {
    shift,
    height,
    onLayout: (event: LayoutChangeEvent) => {
      setHeight(event.nativeEvent.layout.height);
    },
  };
}

/** Where a hero's back tile sits and how large it is, from the board. */
export interface HeroBackPlace {
  readonly left: number;
  readonly top: number;
  readonly side: number;
  readonly radius: number;
  readonly icon: number;
}

/**
 * The back tile at the top left of a Category-style screen's hero: the back
 * arrow in `ink` on a `tile`, `shift` lower under a tall safe area.
 */
export function HeroBack({
  id,
  back,
  place,
  shift,
  tile,
  ink,
}: {
  /** The hero's id: the tile's test ID is `<id>-back` unless `back` names one. */
  id: string;
  back: { label: string; onPress: () => void; testID?: string };
  place: HeroBackPlace;
  shift: number;
  tile: string;
  ink: string;
}) {
  const { voice } = useEdition();
  return (
    <Pressable
      testID={back.testID ?? `${id}-back`}
      accessibilityRole="button"
      accessibilityLabel={back.label}
      {...voice}
      onPress={back.onPress}
      style={({ pressed }) => [
        styles.back,
        {
          top: place.top + shift,
          left: place.left,
          width: place.side,
          height: place.side,
          borderRadius: place.radius,
          backgroundColor: tile,
        },
        pressed && styles.pressed,
      ]}
    >
      <Icon name="back" size={place.icon} color={ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: pressedFade },
});
