import { describe, expect, it } from 'vitest';

import { createHaptics, type HapticEngine } from './index';

function engine(): HapticEngine & { played: string[] } {
  const played: string[] = [];
  return {
    played,
    selection: () => played.push('selection'),
    impactLight: () => played.push('impactLight'),
    impactMedium: () => played.push('impactMedium'),
    success: () => played.push('success'),
    warning: () => played.push('warning'),
  };
}

describe('haptics', () => {
  it('plays every haptic while Vibration is on', () => {
    const device = engine();
    const haptics = createHaptics({ engine: device, vibration: () => true });

    haptics.selection();
    haptics.impactLight();
    haptics.impactMedium();
    haptics.success();
    haptics.warning();

    expect(device.played).toEqual([
      'selection',
      'impactLight',
      'impactMedium',
      'success',
      'warning',
    ]);
  });

  it('plays no haptic while Vibration is off', () => {
    const device = engine();
    const haptics = createHaptics({ engine: device, vibration: () => false });

    haptics.selection();
    haptics.impactLight();
    haptics.impactMedium();
    haptics.success();
    haptics.warning();

    expect(device.played).toEqual([]);
  });

  it('follows Vibration as the user turns it off and on', () => {
    const device = engine();
    let vibration = true;
    const haptics = createHaptics({ engine: device, vibration: () => vibration });

    haptics.selection();
    vibration = false;
    haptics.selection();
    haptics.impactLight();
    haptics.success();
    vibration = true;
    haptics.impactLight();
    haptics.warning();

    expect(device.played).toEqual(['selection', 'impactLight', 'warning']);
  });
});
