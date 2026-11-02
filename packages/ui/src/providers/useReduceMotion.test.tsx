import { ReduceMotionProvider, useReduceMotion } from '@slovo/ui';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

function Probe() {
  return <Text testID="probe">{useReduceMotion() ? 'reduced' : 'full'}</Text>;
}

async function motionWith({ system, setting }: { system: boolean; setting: boolean }) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(system);
  await render(
    <ReduceMotionProvider reduceMotion={setting}>
      <Probe />
    </ReduceMotionProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return screen.getByTestId('probe').props['children'];
}

describe('useReduceMotion', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports reduced motion when «Менше руху» is on', async () => {
    expect(await motionWith({ system: false, setting: true })).toBe('reduced');
  });

  it("reports reduced motion when the system's Reduce Motion is on", async () => {
    expect(await motionWith({ system: true, setting: false })).toBe('reduced');
  });

  it('reports the full motion when neither is on', async () => {
    expect(await motionWith({ system: false, setting: false })).toBe('full');
  });

  it("follows the system's Reduce Motion outside a provider", async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(<Probe />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('probe').props['children']).toBe('reduced');
  });
});
