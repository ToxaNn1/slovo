import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCurrency } from './currency';

describe('the currency of «Сервіси»', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is dollars when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(renderHook(() => useCurrency()).result.current[0]).toBe('USD');
  });

  it('still switches when storage refuses to keep the pick', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const { result } = renderHook(() => useCurrency());

    act(() => {
      result.current[1]('UAH');
    });

    expect(result.current[0]).toBe('UAH');
  });
});
