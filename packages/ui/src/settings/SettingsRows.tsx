import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { fill, useEdition } from '../providers/EditionProvider';
import { rowActionProps, SwipeableRow, type RowAction } from '../primitives/SwipeableRow';
import { minTouchTarget, overlineType, space, STACK_AT_FONT_SCALE, typeSize } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** How much a row that a later version brings is dimmed. */
const SOON_OPACITY = 0.5;

/** A card that holds rows under one another, with a hairline between two rows. */
export function SettingsGroup({ children }: { children: ReactNode }) {
  const { colors, radii } = useTokens();
  return (
    <View
      style={[
        styles.group,
        { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.card },
      ]}
    >
      {Children.toArray(children).map((row, index) => (
        <Fragment key={index}>
          {index > 0 && <View style={[styles.divider, { backgroundColor: colors.line }]} />}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

interface RowProps {
  readonly label: string;
  readonly testID?: string;
}

/** What a row says on its right and where it stands in its group. */
function useRowLook() {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return {
    voice,
    colors,
    fontFamilies,
    label: [styles.label, { color: colors.ink, fontFamily: fontFamilies.ui }],
    value: [styles.value, { color: colors.muted, fontFamily: fontFamilies.ui }],
  };
}

function Chevron() {
  const { colors } = useTokens();
  return (
    <Svg width={8} height={14} viewBox="0 0 8 14">
      <Path
        d="M1 1l6 6-6 6"
        fill="none"
        stroke={colors.muted}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** A row that opens a screen, with the setting's value on its right. */
export function NavigationRow({
  label,
  value,
  onPress,
  testID,
}: RowProps & { value?: string | undefined; onPress: () => void }) {
  const look = useRowLook();
  // At the largest text sizes the value drops under the label instead of squeezing it.
  const stacked = useWindowDimensions().fontScale > STACK_AT_FONT_SCALE;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={value === undefined ? label : `${label}, ${value}`}
      {...look.voice}
      onPress={onPress}
      style={styles.row}
    >
      {stacked ? (
        <View style={styles.grow}>
          <Text style={look.label}>{label}</Text>
          {value !== undefined && <Text style={look.value}>{value}</Text>}
        </View>
      ) : (
        <>
          <Text style={[look.label, styles.grow]}>{label}</Text>
          {value !== undefined && <Text style={[look.value, styles.trailing]}>{value}</Text>}
        </>
      )}
      <Chevron />
    </Pressable>
  );
}

/** A row with an on/off switch, and an optional line of muted text under its label. */
export function SwitchRow({
  label,
  subtitle,
  value,
  onChange,
  testID,
}: RowProps & { subtitle?: string; value: boolean; onChange: (value: boolean) => void }) {
  const look = useRowLook();
  // At the largest text sizes the switch drops under the label instead of squeezing it.
  const stacked = useWindowDimensions().fontScale > STACK_AT_FONT_SCALE;
  return (
    <View style={[styles.row, stacked && styles.stackedRow]}>
      <View style={!stacked && styles.grow}>
        <Text style={look.label}>{label}</Text>
        {subtitle !== undefined && <Text style={look.value}>{subtitle}</Text>}
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        {...look.voice}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: look.colors.track, true: look.colors.accent }}
        ios_backgroundColor={look.colors.track}
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
          style={[
            styles.time,
            styles.grow,
            { color: look.colors.ink, fontFamily: look.fontFamilies.word },
          ]}
        >
          {time}
        </Text>
        <Chevron />
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
      accessibilityLabel={[fill(soonAccessibilityLabel, { label }), subtitle]
        .filter((part) => part !== undefined)
        .join('. ')}
      {...look.voice}
      style={[styles.row, styles.soonRow]}
    >
      <View style={styles.soonLine}>
        <View style={styles.soonText}>
          <Text style={look.label}>{label}</Text>
          {subtitle !== undefined && <Text style={look.value}>{subtitle}</Text>}
        </View>
        <Text style={[styles.soon, { color: look.colors.muted, fontFamily: look.fontFamilies.ui }]}>
          {soon}
        </Text>
        {control === 'switch' && (
          <Switch
            disabled
            value
            trackColor={{ false: look.colors.track, true: look.colors.accent }}
            importantForAccessibility="no-hide-descendants"
          />
        )}
      </View>
      {control === 'slider' && <SliderTrack />}
    </View>
  );
}

/** A slider's track and thumb, drawn only, for the row that waits for its version. */
function SliderTrack() {
  const { colors } = useTokens();
  return (
    <View style={[styles.sliderTrack, { backgroundColor: colors.track }]}>
      <View style={[styles.sliderFill, { backgroundColor: colors.accent }]} />
      <View
        style={[styles.sliderThumb, { backgroundColor: colors.surface, borderColor: colors.line }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth },
  group: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: {
    minHeight: minTouchTarget + space[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  stackedRow: { flexDirection: 'column', alignItems: 'flex-start' },
  label: { fontSize: typeSize.body, fontWeight: '500' },
  value: { fontSize: typeSize.body },
  time: { fontSize: 22, fontWeight: '500' },
  soonRow: {
    opacity: SOON_OPACITY,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: space[2],
  },
  soonLine: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  grow: { flex: 1 },
  trailing: { flexShrink: 1, textAlign: 'right' },
  soonText: { flex: 1 },
  soon: { ...overlineType, flexShrink: 0 },
  sliderTrack: { height: 4, borderRadius: 2, justifyContent: 'center' },
  sliderFill: { width: '35%', height: 4, borderRadius: 2 },
  sliderThumb: {
    position: 'absolute',
    left: '35%',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
