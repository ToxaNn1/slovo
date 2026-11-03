import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../primitives/Icon';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { iconButton, pressedFade, settingsHeader, typeStyle } from '../tokens';

/** How far the largest text sizes of iOS may scale the title. */
const TITLE_MAX_FONT_SCALE = 1.3;

/**
 * The header of Settings and of the screens its rows open, as the board draws
 * it (design `SlovoApp`, Settings and its sub-screens): the 44-point back
 * tile and, beside it, the screen's title. Settings itself carries the larger
 * title; a screen it opens, the smaller one. The tile is drawn only when
 * there is somewhere to go back to, and VoiceOver reads it by `back.label`,
 * the name of the screen it returns to.
 */
export function SettingsHeader({
  kind,
  title,
  back,
}: {
  kind: 'settings' | 'subScreen';
  title: string;
  back?: { label: string; onPress: () => void; testID?: string } | undefined;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  return (
    <View style={styles.header}>
      {back !== undefined && (
        <Pressable
          testID={back.testID}
          accessibilityRole="button"
          accessibilityLabel={back.label}
          {...voice}
          onPress={back.onPress}
          style={({ pressed }) => [
            styles.tile,
            {
              borderRadius: radii.tile,
              backgroundColor: colors.surfaceSunken,
              opacity: pressed ? pressedFade : 1,
            },
          ]}
        >
          <Icon name="back" size={iconButton.icon} color={colors.ink} />
        </Pressable>
      )}
      <Text
        accessibilityRole="header"
        {...voice}
        maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}
        style={[
          styles.title,
          typeStyle(kind === 'settings' ? 'settingsTitle' : 'settingsSubTitle', tokens),
          { color: colors.ink },
        ]}
      >
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: settingsHeader.gap,
    paddingBottom: settingsHeader.paddingBottom,
  },
  tile: {
    width: iconButton.side,
    height: iconButton.side,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flexShrink: 1 },
});
