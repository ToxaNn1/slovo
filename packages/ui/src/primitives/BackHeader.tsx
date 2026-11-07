import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { backHeader, typeStyle, type TypeRole } from '../tokens';
import { Button } from './Button';
import { IconButton } from './IconButton';

/** How far the largest text sizes of iOS may scale the title. */
const TITLE_MAX_FONT_SCALE = 1.3;

/**
 * A screen's header as the boards draw it (design `SlovoApp`: Settings, the
 * screens its rows open, the Daily Crossword): the 44-point back tile and,
 * beside it, the screen's title in `titleRole`. The tile is drawn only when
 * there is somewhere to go back to, and VoiceOver reads it by `back.label`,
 * the name of the screen it returns to. A screen's own `action`, such as the
 * Daily Crossword's «Підказка», sits at the far end as a small button.
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
        maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}
        style={[styles.title, typeStyle(titleRole, tokens), { color: tokens.colors.ink }]}
      >
        {title}
      </Text>
      {action !== undefined && (
        <View style={styles.action}>
          <Button
            variant="neutral"
            size="small"
            label={action.label}
            onPress={action.onPress}
            testID={action.testID}
          />
        </View>
      )}
    </View>
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
  action: { marginLeft: 'auto' },
});
