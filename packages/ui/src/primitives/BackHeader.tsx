import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useInterfaceSounds } from '../providers/InterfaceSoundsProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { useTokens } from '../providers/TokensProvider';
import { backHeader, pressedFade, typeStyle, type TypeRole } from '../tokens';
import { IconButton } from './IconButton';

/** How far the largest text sizes of iOS may scale the title. */
const TITLE_MAX_FONT_SCALE = 1.3;

/**
 * A screen's header as the boards draw it (design `SlovoApp`: Settings, the
 * screens its rows open, the Daily Crossword): the 44-point back tile and,
 * beside it, the screen's title in `titleRole`. The tile is drawn only when
 * there is somewhere to go back to, and VoiceOver reads it by `back.label`,
 * the name of the screen it returns to. A screen's own `action`, such as the
 * Daily Crossword's «Підказка», sits at the far end as an ink plate (board 08),
 * and the title keeps to one line beside it.
 */
export function BackHeader({
  title,
  titleRole,
  back,
  action,
}: {
  title: string;
  titleRole: TypeRole;
  back?: { label: string; onPress: () => void; testID?: string } | undefined;
  action?: { label: string; onPress: () => void; testID?: string } | undefined;
}) {
  const tokens = useTokens();
  const { voice } = useEdition();
  return (
    <View style={styles.header}>
      {back !== undefined && (
        <IconButton
          testID={back.testID}
          icon="back"
          accessibilityLabel={back.label}
          onPress={back.onPress}
        />
      )}
      <Text
        accessibilityRole="header"
        {...voice}
        numberOfLines={action === undefined ? undefined : 1}
        adjustsFontSizeToFit={action !== undefined}
        maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}
        style={[styles.title, typeStyle(titleRole, tokens), { color: tokens.colors.ink }]}
      >
        {title}
      </Text>
      {action !== undefined && <HeaderAction {...action} />}
    </View>
  );
}

/** The header's own action: its label on an ink plate, shrinking a little while pressed, or fading under Reduce Motion. */
function HeaderAction({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const sounds = useInterfaceSounds();
  const reduceMotion = useReduceMotion();
  const { pressedScale } = backHeader.action;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        sounds.play('tap');
        onPress();
      }}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: colors.ink },
        pressed &&
          (reduceMotion ? { opacity: pressedFade } : { transform: [{ scale: pressedScale }] }),
      ]}
    >
      <Text
        {...voice}
        numberOfLines={1}
        maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}
        style={[typeStyle('headerAction', tokens), { color: colors.background }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: backHeader.gap,
    paddingBottom: backHeader.paddingBottom,
  },
  title: { flexShrink: 1 },
  action: {
    marginLeft: 'auto',
    minHeight: backHeader.action.height,
    paddingHorizontal: backHeader.action.paddingHorizontal,
    borderRadius: backHeader.action.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
