import { describe, expect, it } from 'vitest';

import { createHaptics } from './index';

function engine() {
  const played: string[] = [];
  return {
    played,
    selection: () => played.push('selection'),
    impactLight: () => played.push('impactLight'),
  };
}

describe('haptics', () => {
  it('plays every haptic while Vibration is on', () => {
    const device = engine();
    const haptics = createHaptics({ engine: device, vibration: () => true });

    haptics.selection();
    haptics.impactLight();

    expect(device.played).toEqual(['selection', 'impactLight']);
  });

  it('plays no haptic while Vibration is off', () => {
    const device = engine();
    const haptics = createHaptics({ engine: device, vibration: () => false });

    haptics.selection();
    haptics.impactLight();

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
    vibration = true;
    haptics.impactLight();

    expect(device.played).toEqual(['selection', 'impactLight']);
  });
});
