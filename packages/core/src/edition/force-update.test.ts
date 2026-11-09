import { describe, expect, it } from 'vitest';

import { forceUpdateOf } from '../index';

const ios = (appVersion: string) => ({ appVersion, platform: 'ios' }) as const;
const minimums = { ios: { soft: '1.4.0', hard: '1.2.0' } };

describe('forceUpdateOf', () => {
  it('asks for an update below the soft minimum', () => {
    expect(forceUpdateOf(minimums, ios('1.3.9'))).toBe('banner');
  });

  it('blocks below the hard minimum', () => {
    expect(forceUpdateOf(minimums, ios('1.1.10'))).toBe('blocking');
    expect(forceUpdateOf({ ios: { hard: '2.0.0' } }, ios('1.9.0'))).toBe('blocking');
  });

  it('asks nothing at or above the soft minimum', () => {
    expect(forceUpdateOf(minimums, ios('1.4.0'))).toBe('none');
    expect(forceUpdateOf(minimums, ios('1.10.0'))).toBe('none');
  });

  it('applies only the minimum of the device’s platform', () => {
    const androidOnly = { android: { soft: '9.0.0', hard: '9.0.0' } };
    expect(forceUpdateOf(androidOnly, ios('1.0.0'))).toBe('none');
    expect(forceUpdateOf(androidOnly, { appVersion: '1.0.0', platform: 'android' })).toBe(
      'blocking',
    );
  });

  it('asks nothing with no minimums or a version that doesn’t read as one', () => {
    expect(forceUpdateOf({}, ios('1.0.0'))).toBe('none');
    expect(forceUpdateOf(minimums, ios(''))).toBe('none');
    expect(forceUpdateOf(minimums, ios('test'))).toBe('none');
    expect(forceUpdateOf({ ios: { hard: 'soon' } }, ios('1.0.0'))).toBe('none');
  });
});
