import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { fill, useEdition } from './EditionProvider';
import { minTouchTarget, overlineType, space, typeSize } from './tokens';
import { useTokens } from './TokensProvider';

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
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={value === undefined ? label : `${label}, ${value}`}
      {...look.voice}
      onPress={onPress}
      style={styles.row}
    >
      <Text style={[look.label, styles.grow]}>{label}</Text>
      {value !== undefined && <Text style={[look.value, styles.trailing]}>{value}</Text>}
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
  return (
    <View style={styles.row}>
      <View style={styles.grow}>
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
  label: { fontSize: typeSize.body, fontWeight: '500' },
  value: { fontSize: typeSize.body },
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
