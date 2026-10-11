import { describe, expect, it } from 'vitest';

import { loadEdition } from './index';

const validConfig = {
  id: 'test',
  locale: 'uk-UA',
  displayName: 'SLOVO',
  bundleId: 'app.slovo.test',
  languageTraits: { marksStress: true },
  categories: [{ id: 'nature', displayName: 'Природа' }],
};

describe('loadEdition', () => {
  it('reports the Edition id, locale and whether it marks Stress', () => {
    const edition = loadEdition(validConfig);

    expect(edition.id).toBe('test');
    expect(edition.locale).toBe('uk-UA');
    expect(edition.languageTraits.marksStress).toBe(true);
  });

  it('reports an Edition that does not mark Stress', () => {
    const edition = loadEdition({ ...validConfig, languageTraits: { marksStress: false } });

    expect(edition.languageTraits.marksStress).toBe(false);
  });

  it('rejects an invalid Edition config, naming the field', () => {
    expect(() => loadEdition({ ...validConfig, locale: undefined })).toThrow(/locale/);
  });
});
