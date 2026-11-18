import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { fill, useEdition } from '../providers/EditionProvider';
import { RowChevron } from '../primitives/RowChevron';
import { rowActionProps, SwipeableRow, type RowAction } from '../primitives/SwipeableRow';
import { SegmentedControl, type Segment } from '../primitives/SegmentedControl';
import { Switch } from '../primitives/Switch';
import {
  minTouchTarget,
  onFill,
  settingsRowDrawing,
  sliderDrawing,
  space,
  STACK_AT_FONT_SCALE,
  typeStyle,
} from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** How much a row that a later version brings is dimmed. */
const SOON_OPACITY = 0.5;

/**
 * A card that holds rows under one another, with a hairline between two rows,
 * under an optional title in the eyebrow role.
 */
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  return (
    <View style={styles.titled}>
      {title !== undefined && (
        <Text
          accessibilityRole="header"
          {...voice}
          style={[styles.title, typeStyle('eyebrow', tokens), { color: colors.muted }]}
        >
          {title}
        </Text>
      )}
      <View
        style={[
          styles.group,
          { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.card },
        ]}
      >
        {Children.toArray(children).map((row, index) => (
          // `toArray` keys each row by its own key, so a row shown or hidden keeps the others mounted.
          <Fragment key={isValidElement(row) ? row.key : index}>
            {index > 0 && <View style={[styles.divider, { backgroundColor: colors.line }]} />}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

/** The slanted shapes a row's icon tile holds (design `SlovoApp`, `ICON`), on a 100 × 100 box. */
const rowIcons = {
  hex: '25,0 75,0 100,50 75,100 25,100 0,50',
  bar: '0,30 100,0 100,70 0,100',
  wedge: '0,0 100,30 100,70 0,100',
  triangle: '0,0 100,50 0,100',
  square: '0,0 100,15 100,100 0,85',
  diamond: '50,0 100,50 50,100 0,50',
} as const;

/** The shape in a row's icon tile. */
export type RowIcon = keyof typeof rowIcons;

/** The sunken tile at a row's start, with its shape in ink; VoiceOver skips it. */
function IconTile({ icon }: { icon: RowIcon }) {
  const { colors } = useTokens();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.iconTile, { backgroundColor: colors.surfaceSunken }]}
    >
      <Svg width={settingsRowDrawing.icon} height={settingsRowDrawing.icon} viewBox="0 0 100 100">
        <Polygon points={rowIcons[icon]} fill={colors.ink} />
      </Svg>
    </View>
  );
}

interface RowProps {
  readonly label: string;
  readonly testID?: string;
  /** The shape in the tile at the row's start; without it, the row has no tile. */
  readonly icon?: RowIcon;
}

/** What a row says on its right and where it stands in its group. */
function useRowLook() {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return {
    voice,
    colors,
    tokens,
    label: [typeStyle('rowLabel', tokens), { color: colors.ink }],
    value: [typeStyle('rowSub', tokens), { color: colors.muted }],
  };
}

/**
 * A row that opens a screen, with the setting's value on its right and an
 * optional line of muted text under its label, which VoiceOver reads as the
 * row's hint.
 */
export function NavigationRow(
  props: RowProps & { subtitle?: string; value?: string | undefined; onPress: () => void },
) {
  return <PressRow {...props} chevron />;
}

/** A row that is pressed: it opens a screen behind its chevron, or runs a plain action without one. */
function PressRow({
  label,
  subtitle,
  value,
  onPress,
  testID,
  icon,
  chevron,
}: RowProps & {
  subtitle?: string | undefined;
  value?: string | undefined;
  onPress: () => void;
  chevron: boolean;
}) {
  const look = useRowLook();
  // At the largest text sizes the value drops under the label instead of squeezing it.
  const stacked = useWindowDimensions().fontScale > STACK_AT_FONT_SCALE;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={value === undefined ? label : `${label}, ${value}`}
      accessibilityHint={subtitle}
      {...look.voice}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: look.colors.surfaceSunken },
      ]}
    >
      {icon !== undefined && <IconTile icon={icon} />}
      {stacked ? (
        <View style={styles.grow}>
          <Text style={look.label}>{label}</Text>
          {subtitle !== undefined && <Text style={look.value}>{subtitle}</Text>}
          {value !== undefined && <Text style={look.value}>{value}</Text>}
        </View>
      ) : (
        <>
          <RowText look={look} label={label} subtitle={subtitle} />
          {value !== undefined && <Text style={[look.value, styles.trailing]}>{value}</Text>}
        </>
      )}
      {chevron && (
        <View testID={testID === undefined ? undefined : `${testID}-chevron`}>
          <RowChevron />
        </View>
      )}
    </Pressable>
  );
}

/** What a settings row has at its end: a chevron with the value it opens, a switch, or a plain action. */
export type SettingsRowEnd =
  | { readonly kind: 'chevron'; readonly value?: string | undefined; readonly onPress: () => void }
  | {
      readonly kind: 'switch';
      readonly value: boolean;
      readonly onChange: (value: boolean) => void;
    }
  | { readonly kind: 'action'; readonly onPress: () => void };

/**
 * A row of the Settings list (board 11, screen 83): its icon, its title, the
 * line under it and one end. The line is given on every row; only a row whose
 * line depends on what the device reports passes undefined.
 */
export function SettingsRow({
  end,
  ...row
}: {
  readonly label: string;
  readonly testID?: string;
  readonly icon: RowIcon;
  readonly subtitle: string | undefined;
  readonly end: SettingsRowEnd;
}) {
  switch (end.kind) {
    case 'chevron':
      return <PressRow {...row} value={end.value} onPress={end.onPress} chevron />;
    case 'switch':
      return <SwitchRow {...row} value={end.value} onChange={end.onChange} />;
    case 'action':
      return <PressRow {...row} onPress={end.onPress} chevron={false} />;
  }
}

/**
 * A row with an on/off switch, and an optional line of muted text under its
 * label. VoiceOver reads the row once, at its switch: the label, then the
 * line as the switch's hint.
 */
export function SwitchRow({
  label,
  subtitle,
  value,
  onChange,
  testID,
  icon,
}: RowProps & {
  subtitle?: string | undefined;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const look = useRowLook();
  // At the largest text sizes the switch drops under the label instead of squeezing it.
  const stacked = useWindowDimensions().fontScale > STACK_AT_FONT_SCALE;
  return (
    <View style={[styles.row, stacked && styles.stackedRow]}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.lead, !stacked && styles.grow]}
      >
        {icon !== undefined && <IconTile icon={icon} />}
        <RowText look={look} label={label} subtitle={subtitle} />
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={subtitle}
        {...look.voice}
        value={value}
        onValueChange={onChange}
      />
    </View>
  );
}

/** A row's label and the optional muted line under it. */
function RowText({
  look,
  label,
  subtitle,
}: {
  look: ReturnType<typeof useRowLook>;
  label: string;
  subtitle: string | undefined;
}) {
  return (
    <View style={styles.text}>
      <Text style={look.label}>{label}</Text>
      {subtitle !== undefined && <Text style={look.value}>{subtitle}</Text>}
    </View>
  );
}

/**
 * A row that picks one of a few values: its label, an optional line and,
 * under them, the segmented control, whose segments VoiceOver reads with the label.
 */
export function ChoiceRow<T extends string>({
  label,
  subtitle,
  icon,
  testID,
  segments,
  selected,
  onSelect,
  children,
}: RowProps & {
  subtitle?: string;
  segments: readonly Segment<T>[];
  selected: T;
  onSelect: (value: T) => void;
  /** What the row shows between its label and its control, e.g. a preview. */
  children?: ReactNode;
}) {
  const look = useRowLook();
  return (
    <View testID={testID} style={[styles.row, styles.choiceRow]}>
      <View style={styles.lead}>
        {icon !== undefined && <IconTile icon={icon} />}
        <RowText look={look} label={label} subtitle={subtitle} />
      </View>
      {children}
      <SegmentedControl
        accessibilityLabel={label}
        segments={segments}
        selected={selected}
        onSelect={onSelect}
      />
    </View>
  );
}

/**
 * A time of day in a group of rows, drawn in the word family, with a chevron.
 * Its actions slide out on a swipe to the left and are VoiceOver actions too.
 * Needs a `GestureHandlerRootView` above it.
 */
export function TimeRow({
  time,
  accessibilityLabel,
  accessibilityHint,
  actions,
  onPress,
  testID,
}: {
  /** The time as the row shows it, e.g. «09:00». */
  time: string;
  /** The row as VoiceOver reads it, e.g. «Сповіщення о 09:00». */
  accessibilityLabel: string;
  /** What VoiceOver adds for a row that a tap acts on, e.g. «Змінити час». */
  accessibilityHint?: string;
  actions: readonly RowAction[];
  /** What a tap does; without it, a tap does nothing. */
  onPress?: () => void;
  testID: string;
}) {
  const look = useRowLook();
  return (
    <SwipeableRow testID={testID} actions={actions}>
      <Pressable
        testID={`${testID}-content`}
        accessible
        accessibilityRole={onPress === undefined ? undefined : 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={onPress === undefined ? undefined : accessibilityHint}
        {...rowActionProps(actions)}
        {...look.voice}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor:
              pressed && onPress !== undefined ? look.colors.surfaceSunken : look.colors.surface,
          },
        ]}
      >
        <Text
          style={[typeStyle('reminderTime', look.tokens), styles.grow, { color: look.colors.ink }]}
        >
          {time}
        </Text>
        <RowChevron />
      </Pressable>
    </SwipeableRow>
  );
}

/**
 * A row that a later version brings: dimmed, tagged with the Edition's
 * "soon", not tappable, and read by VoiceOver as unavailable. It may keep the
 * look of what it will be (a switch, a slider).
 */
export function SoonRow({
  label,
  subtitle,
  testID,
  control,
}: RowProps & { subtitle?: string; control?: 'switch' | 'slider' }) {
  const look = useRowLook();
  const { strings } = useEdition();
  const { soon, soonAccessibilityLabel } = strings.settings;
  return (
    <View
      testID={testID}
      accessible
      accessibilityState={{ disabled: true }}
      // The subtitle goes on the label's phrase («Запропонувати слово або Виправлення»),
      // so VoiceOver reads them as one before the "soon".
      accessibilityLabel={fill(soonAccessibilityLabel, {
        label: subtitle === undefined ? label : `${label} ${subtitle}`,
      })}
      {...look.voice}
      style={[styles.row, styles.soonRow]}
    >
      <View style={styles.soonLine}>
        <View style={styles.soonText}>
          <Text style={look.label}>{label}</Text>
          {subtitle !== undefined && <Text style={look.value}>{subtitle}</Text>}
        </View>
        <Text
          style={[typeStyle('soonTag', look.tokens), styles.soon, { color: look.colors.muted }]}
        >
          {soon}
        </Text>
        {control === 'switch' && (
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Switch disabled value onValueChange={noChange} />
          </View>
        )}
      </View>
      {control === 'slider' && <SliderTrack />}
    </View>
  );
}

/** A slider's track and thumb, drawn only, for the row that waits for its version. */
/** The cross on a destructive card's tile (design `SlovoApp`, the reset button), on a 20 × 20 box. */
const CROSS = '0,3 3,0 10,7 17,0 20,3 13,10 20,17 17,20 10,13 3,20 0,17 7,10';

/**
 * A card of its own for a single destructive action, under the groups: a
 * cross on a destructive tile and the label, centred.
 */
export function SettingsActionCard({
  label,
  testID,
  onPress,
}: {
  label: string;
  testID?: string;
  onPress: () => void;
}) {
  const look = useRowLook();
  const { colors, radii } = look.tokens;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...look.voice}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        styles.actionCard,
        {
          backgroundColor: pressed ? colors.surfaceSunken : colors.surface,
          borderColor: colors.line,
          borderRadius: radii.card,
        },
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.iconTile, { backgroundColor: colors.destructive }]}
      >
        <Svg width={settingsRowDrawing.icon} height={settingsRowDrawing.icon} viewBox="0 0 20 20">
          <Polygon points={CROSS} fill={onFill} />
        </Svg>
      </View>
      <Text style={look.label}>{label}</Text>
    </Pressable>
  );
}

function SliderTrack() {
  const { colors } = useTokens();
  return (
    <View style={[styles.sliderTrack, { backgroundColor: colors.silhouette }]}>
      <View style={[styles.sliderFill, { backgroundColor: colors.accent }]} />
      <View
        style={[styles.sliderThumb, { backgroundColor: colors.surface, borderColor: colors.line }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth },
  titled: { gap: space[2] },
  title: { paddingHorizontal: space[1] },
  group: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: {
    minHeight: minTouchTarget + space[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: settingsRowDrawing.gap,
    paddingHorizontal: settingsRowDrawing.paddingHorizontal,
    paddingVertical: settingsRowDrawing.paddingVertical,
  },
  stackedRow: { flexDirection: 'column', alignItems: 'flex-start' },
  choiceRow: { flexDirection: 'column', alignItems: 'stretch' },
  lead: { flexDirection: 'row', alignItems: 'center', gap: settingsRowDrawing.gap },
  text: { flex: 1, minWidth: 0, gap: space[1] },
  iconTile: {
    width: settingsRowDrawing.iconTile,
    height: settingsRowDrawing.iconTile,
    borderRadius: settingsRowDrawing.iconTileRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonRow: {
    opacity: SOON_OPACITY,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: space[2],
  },
  soonLine: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  actionCard: { justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  grow: { flex: 1 },
  trailing: { flexShrink: 1, textAlign: 'right' },
  soonText: { flex: 1 },
  soon: { flexShrink: 0 },
  sliderTrack: {
    height: sliderDrawing.trackHeight,
    borderRadius: sliderDrawing.trackRadius,
    justifyContent: 'center',
  },
  sliderFill: {
    width: '35%',
    height: sliderDrawing.trackHeight,
    borderRadius: sliderDrawing.trackRadius,
  },
  sliderThumb: {
    position: 'absolute',
    left: '35%',
    width: sliderDrawing.thumbSize,
    height: sliderDrawing.thumbSize,
    borderRadius: sliderDrawing.thumbRadius,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

/** The toggle of a row that waits for its version takes no change. */
const noChange = () => undefined;
