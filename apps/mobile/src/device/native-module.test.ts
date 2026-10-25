import { describe, expect, it, vi } from 'vitest';

import { createNativeModules, type NativeModuleProbes } from './native-module';

const installed: NativeModuleProbes = {
  notifications: () => true,
  timePicker: () => true,
  widget: () => true,
  shareCapture: () => true,
  contentUpdates: () => true,
  keychain: () => true,
  googleSignIn: () => true,
};

describe('the native modules of the installed dev client', () => {
  it('reports a module the client has', () => {
    const modules = createNativeModules(installed);

    expect(modules.has('notifications')).toBe(true);
    expect(modules.has('timePicker')).toBe(true);
  });

  it('reports a missing module without throwing', () => {
    const modules = createNativeModules({ ...installed, notifications: () => false });

    expect(modules.has('notifications')).toBe(false);
    expect(modules.has('timePicker')).toBe(true);
  });

  it('reports a module as missing when looking for it throws', () => {
    const modules = createNativeModules({
      ...installed,
      timePicker: () => {
        throw new Error('native registry unavailable');
      },
    });

    expect(modules.has('timePicker')).toBe(false);
  });

  it('loads a present module and hands back its JavaScript', () => {
    const modules = createNativeModules(installed);

    expect(modules.load('notifications', () => ({ scheduled: true }))).toEqual({
      scheduled: true,
    });
  });

  it('does not load a missing module', () => {
    const load = vi.fn(() => ({ scheduled: true }));
    const modules = createNativeModules({ ...installed, notifications: () => false });

    expect(modules.load('notifications', load)).toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });

  it('reports a module as missing when loading its JavaScript throws', () => {
    const modules = createNativeModules(installed);

    const loaded = modules.load<string>('timePicker', () => {
      throw new Error('View config not found');
    });

    expect(loaded).toBeUndefined();
  });

  it('looks each module up once', () => {
    const notifications = vi.fn(() => true);
    const modules = createNativeModules({ ...installed, notifications });

    modules.has('notifications');
    modules.has('notifications');

    expect(notifications).toHaveBeenCalledTimes(1);
  });
});
