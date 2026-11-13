import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTheme } from './theme';

describe('the Theme', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to the system Theme when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current[0]).toBe('light');
  });

  it('still switches when storage refuses to keep the pick', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current[1]('dark');
    });

    expect(result.current[0]).toBe('dark');
  });
});
