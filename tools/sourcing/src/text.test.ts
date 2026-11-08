import { describe, expect, it } from 'vitest';

import { withoutHomonymIndexes } from './text';

describe('withoutHomonymIndexes', () => {
  it('drops the homonym index a dictionary glues to a word it refers to, keeping the meaning number', () => {
    expect(withoutHomonymIndexes('Те саме, що склад1 1.')).toBe('Те саме, що склад 1.');
    expect(withoutHomonymIndexes('Плітка (див. плі́тка1); чутка.')).toBe(
      'Плітка (див. плі́тка); чутка.',
    );
    expect(withoutHomonymIndexes('Лютий (див. лю́тий2).')).toBe('Лютий (див. лю́тий).');
    expect(withoutHomonymIndexes('укр. луг1– Фасмер')).toBe('укр. луг– Фасмер');
  });

  it('keeps the numbers that are no homonym index', () => {
    expect(withoutHomonymIndexes('Те саме, що імла́ 1.')).toBe('Те саме, що імла́ 1.');
    expect(withoutHomonymIndexes('– СІС2 648; Brückner 249')).toBe('– СІС2 648; Brückner 249');
    expect(withoutHomonymIndexes('Літак Ту-154 і вітамін B12.')).toBe(
      'Літак Ту-154 і вітамін B12.',
    );
  });
});
