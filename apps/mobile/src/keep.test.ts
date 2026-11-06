import { afterEach, describe, expect, it, vi } from 'vitest';

import { keep } from './keep';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('keep', () => {
  it('resolves to what the change kept', async () => {
    await expect(keep('Favorites', Promise.resolve(true), false)).resolves.toBe(true);
  });

  it('logs a change that could not be kept and resolves to the subject as it was', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const kept = await keep('Favorites', Promise.reject(new Error('disk full')), false);

    expect(kept).toBe(false);
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0]?.[0]).toBe('Could not keep the change of Favorites');
  });

  it('resolves to nothing for a change with no value to fall back on', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(keep('the Mix', Promise.reject(new Error('disk full')))).resolves.toBeUndefined();
  });
});
