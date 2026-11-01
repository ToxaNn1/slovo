import { describe, expect, it, vi } from 'vitest';

import { editionRegistry } from './registry';

/** The bundled files of two Editions, told apart by their configs. */
const { editions } = vi.hoisted(() => {
  const files = (id: string) => ({
    config: { id },
    strings: {},
    tokens: undefined,
    decor: undefined,
    illustrations: {},
    languagePack: 1,
  });
  return { editions: { uk: files('uk'), pl: files('pl') } };
});

// The module Metro writes (see metro.config.cjs), which `bundledEditions` reads on import.
vi.mock('slovo-editions', () => ({ default: { defaultId: 'uk', editions } }));

describe('the Edition registry', () => {
  it('lists the bundled Editions and resolves the default', () => {
    const registry = editionRegistry(editions, 'uk');

    expect(registry.ids).toEqual(['uk', 'pl']);
    expect(registry.defaultId).toBe('uk');
    expect(registry.files('uk')).toBe(editions.uk);
    expect(registry.files('pl')).toBe(editions.pl);
  });

  it('refuses a default Edition that is not bundled', () => {
    expect(() => editionRegistry(editions, 'cs')).toThrow(
      'The bundled default Edition "cs" is not bundled',
    );
  });

  it('throws for an Edition that is not bundled', () => {
    expect(() => editionRegistry(editions, 'uk').files('cs')).toThrow('No Edition "cs" is bundled');
  });
});
