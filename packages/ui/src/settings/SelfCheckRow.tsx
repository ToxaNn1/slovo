import { SwitchRow } from './SettingsRows';

/**
 * The Settings switch for Self-check. Nothing is drawn while `shown` is false,
 * which is while the selfCheck Feature Switch is off in effect (ADR 0040).
 */
export function SelfCheckRow({
  label,
  shown,
  value,
  onChange,
}: {
  label: string;
  shown: boolean;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  if (!shown) return null;
  return <SwitchRow testID="settings-self-check" label={label} value={value} onChange={onChange} />;
}
