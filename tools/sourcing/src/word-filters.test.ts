import { describe, expect, it } from 'vitest';

import { REFERENCE_MARKERS, crossReferenceTarget, isCrossReference } from './word-filters';

describe('isCrossReference', () => {
  it.each(REFERENCE_MARKERS)(
    'knows the СУМ marker «%s», in any case and after a register label',
    (marker) => {
      expect(isCrossReference(`${marker} вікно́.`)).toBe(true);
      expect(isCrossReference(`${marker.toLocaleLowerCase('uk')} вікно́.`)).toBe(true);
      expect(isCrossReference(`розм. ${marker} вікно́.`)).toBe(true);
      expect(isCrossReference(`діал., розм. ${marker} вікно́.`)).toBe(true);
    },
  );

  it('leaves a Definition that explains the word, or names a marker further on', () => {
    expect(isCrossReference('Віз, підвода.')).toBe(false);
    expect(isCrossReference('Маленьке вікно; те саме, що кватирка.')).toBe(false);
    expect(isCrossReference('Дивак, чудило.')).toBe(false);
    expect(isCrossReference('Жінка, що доглядає дітей.')).toBe(false);
  });
});

describe('crossReferenceTarget', () => {
  it.each(REFERENCE_MARKERS)(
    'reads the Lemma «%s» points at, without its Stress or homonym index',
    (marker) => {
      expect(crossReferenceTarget(`${marker} вікно́.`)).toBe('вікно');
      expect(crossReferenceTarget(`розм. ${marker} я́тір 1.`)).toBe('ятір');
      expect(crossReferenceTarget(`${marker} пів-ві́кна, м'я́та.`)).toBe('пів-вікна');
    },
  );

  it('reads nothing from a Definition that explains the word', () => {
    expect(crossReferenceTarget('Віз, підвода.')).toBeUndefined();
    expect(crossReferenceTarget('Маленьке вікно; те саме, що кватирка.')).toBeUndefined();
  });
});
