import { describe, expect, it } from 'vitest';

import { slugOf, slugsById } from './slug';

describe('the slug of a Word page', () => {
  it('transliterates by the official rules, «зг» as «zgh»', () => {
    expect(slugOf('кракелюр')).toBe('krakeliur');
    expect(slugOf('гризота')).toBe('hryzota');
    expect(slugOf('ящірка')).toBe('yashchirka');
    expect(slugOf('згин')).toBe('zghyn');
    expect(slugOf('ґанок')).toBe('ganok');
    expect(slugOf('Харків')).toBe('kharkiv');
  });

  it('spells є, ї, й, ю, я otherwise at the start of a word only', () => {
    expect(slugOf('єнот')).toBe('yenot');
    expect(slugOf('їжак')).toBe('yizhak');
    expect(slugOf('йорж')).toBe('yorzh');
    expect(slugOf('юшка')).toBe('yushka');
    expect(slugOf('мрія')).toBe('mriia');
    expect(slugOf('займати')).toBe('zaimaty');
    expect(slugOf('стара ятка')).toBe('stara-yatka');
  });

  it('drops Stress marks, the soft sign and apostrophes, and hyphenates every other mark', () => {
    expect(slugOf('кракелю́р')).toBe('krakeliur');
    expect(slugOf('сіль')).toBe('sil');
    expect(slugOf("м'ята")).toBe('miata');
    expect(slugOf('м’ята')).toBe('miata');
    expect(slugOf('хоч-не-хоч')).toBe('khoch-ne-khoch');
    expect(slugOf(' на  ввесь, світ! ')).toBe('na-vves-svit');
  });

  it('gives a shared slug to the first Word by id and numbers the others', () => {
    const slugs = slugsById([
      { id: 'w_c', lemma: 'коса' },
      { id: 'w_a', lemma: 'коса' },
      { id: 'w_b', lemma: 'ко́са' },
      { id: 'w_d', lemma: 'ліс' },
    ]);
    expect(Object.fromEntries(slugs)).toEqual({
      w_a: 'kosa',
      w_b: 'kosa-2',
      w_c: 'kosa-3',
      w_d: 'lis',
    });
  });
});
