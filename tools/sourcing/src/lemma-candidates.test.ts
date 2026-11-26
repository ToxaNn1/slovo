import { describe, expect, it } from 'vitest';

import { rarityBand, sourceLemmas, type LemmaSourcingInput } from './lemma-candidates';
import { seededRandom } from './test-support';

const ALPHABET = 'а б в г ґ д е є ж з и і ї й к л м н о п р с т у ф х ц ч ш щ ь ю я'.split(' ');

/** A tiny headword list in the format the dictionary is cached in: `<lemma>\t<tags>`. */
const HEADWORDS = [
  'мжичка\tnoun:inanim:f:v_naz',
  'мжичка\tnoun:inanim:f:v_zna',
  'бабак\tnoun:anim:m:v_naz',
  'вода\tnoun:inanim:f:v_naz',
  'дзвонар\tnoun:anim:m:v_naz',
  'Аахен\tnoun:inanim:m:v_naz:prop:geo',
  'Петро\tnoun:anim:m:v_naz:prop:fname',
  'ООН\tnoun:inanim:f:v_naz:nv:abbr',
  'вуй\tnoun:anim:m:v_naz:arch',
  'гуторити\tverb:imperf:inf:rare',
  'ґазда\tnoun:anim:m:v_naz:dial',
  'перст\tnoun:inanim:m:v_naz:arch',
  'вельми\tadv:arch',
  'вельми\tadv',
  'гарбуз\tnoun:inanim:m:v_naz:alt',
  'гарбуз\tnoun:inanim:m:v_naz',
  'замазурений\tadj:m:v_naz:adjp:pasv:perf',
  'ґречний\tadj:m:v_naz',
  'ґречно\tadv',
  'бринькати\tverb:imperf:inf',
  'битися\tverb:imperf:inf:rev',
  'віч-на-віч\tadv',
  'pH\tnoun:inanim:m:v_naz:nv:abbr',
  'хтось\tnoun:anim:m:v_naz:pron:ind',
  'дин\tnumr:m:v_naz:short',
  'ой\tintj',
].join('\n');

const ZIPF: Readonly<Record<string, number>> = {
  мжичка: 1.62,
  бабак: 2.1,
  вода: 4.9,
  гарбуз: 2.5,
  ґречний: 1.48,
  ґречно: 1.93,
  бринькати: 0.8,
  перст: 1.62,
  вельми: 1.62,
};

function input(overrides: Partial<LemmaSourcingInput> = {}): LemmaSourcingInput {
  return {
    headwords: HEADWORDS,
    zipf: (lemma) => ZIPF[lemma] ?? 0,
    alphabet: ALPHABET,
    existingLemmas: [],
    excludeLists: [],
    options: {},
    random: seededRandom(),
    ...overrides,
  };
}

/** The list lines without comments, as `source:words` reads them. */
function lines(list: string): string[] {
  return list
    .split('\n')
    .map((line) => line.replace(/#.*/, '').trim())
    .filter((line) => line !== '');
}

describe('rarityBand', () => {
  it.each([
    [4.9, 1],
    [2.5, 1],
    [2.49, 2],
    [1.93, 2],
    [1.92, 3],
    [1.48, 3],
    [1.47, 4],
    [0.01, 4],
    [0, 5],
  ])('maps Zipf %f to rarity %i on the bands of ADR 0146', (zipf, band) => {
    expect(rarityBand(zipf)).toBe(band);
  });
});

describe('sourceLemmas', () => {
  it('keeps only common nouns, verbs, adjectives and adverbs of bands 2–5, in the source:words format', () => {
    const result = sourceLemmas(input({ options: { count: '100' } }));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(lines(result.list).sort()).toEqual(
      [
        'бабак ? 2',
        'бринькати ? 4',
        'битися ? 5',
        'вельми ? 3',
        'вуй ? 5',
        'гуторити ? 5',
        'дзвонар ? 5',
        'мжичка ? 3',
        'перст ? 4',
        'ґречний ? 3',
        'ґречно ? 2',
      ].sort(),
    );
  });

  it('keeps rare and archaic Lemmas, an archaic one a rarity higher (at most 5), and drops dialect ones', () => {
    const result = sourceLemmas(input({ options: { count: '100' } }));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const picked = lines(result.list);
    expect(picked).toContain('гуторити ? 5');
    expect(picked).toContain('перст ? 4');
    expect(picked).toContain('вуй ? 5');
    expect(picked.map((line) => line.split(' ')[0])).not.toContain('ґазда');
  });

  it('gives an archaic Lemma the rarity that keeps it out of band 1 a place in band 2', () => {
    const result = sourceLemmas(
      input({
        headwords: 'перст\tnoun:inanim:m:v_naz:arch',
        zipf: () => 3.1,
        options: { count: '100' },
      }),
    );
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(lines(result.list)).toEqual(['перст ? 2']);
  });

  it('does not raise the rarity of a Lemma with a form that is not archaic', () => {
    const result = sourceLemmas(input({ options: { count: '100', letters: 'в', pos: 'adv:1' } }));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(lines(result.list)).toEqual(['вельми ? 3']);
  });

  it('notes the part of speech and the Zipf on each line, after a comment sign', () => {
    const result = sourceLemmas(input({ options: { count: '100', letters: 'м' } }));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.list).toContain('мжичка ? 3 # noun, Zipf 1.62');
  });

  it('drops the Lemmas the Edition already has, stressed or not, and the reflexive pair of one', () => {
    const result = sourceLemmas(
      input({ existingLemmas: ['Бабак', 'мжи́чка', 'бити'], options: { count: '100' } }),
    );
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const lemmas = lines(result.list).map((line) => line.split(' ')[0]);
    expect(lemmas).not.toContain('бабак');
    expect(lemmas).not.toContain('мжичка');
    expect(lemmas).not.toContain('битися');
    expect(lemmas).toContain('дзвонар');
  });

  it('drops the Lemmas of the exclude lists, by their first field', () => {
    const result = sourceLemmas(
      input({
        excludeLists: ['# an earlier wave\nдзвонар  nature-weather 3\n', 'ґречно ? 2 # adv'],
        options: { count: '100' },
      }),
    );
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const lemmas = lines(result.list).map((line) => line.split(' ')[0]);
    expect(lemmas).not.toContain('дзвонар');
    expect(lemmas).not.toContain('ґречно');
    expect(lemmas).toContain('бабак');
  });

  it('keeps only the Lemmas that start with the given letters', () => {
    const result = sourceLemmas(input({ options: { count: '100', letters: 'ґ,м' } }));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(
      lines(result.list)
        .map((line) => line.split(' ')[0])
        .sort(),
    ).toEqual(['мжичка', 'ґречний', 'ґречно'].sort());
  });

  it('splits the count by the part-of-speech shares', () => {
    const result = sourceLemmas(input({ options: { count: '2', pos: 'verb:1,adv:1' } }));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const picked = lines(result.list);
    expect(picked).toHaveLength(2);
    expect(picked).toContain('ґречно ? 2');
    expect(
      picked.filter((line) => ['бринькати', 'битися'].includes(line.split(' ')[0] ?? '')),
    ).toHaveLength(1);
  });

  it('splits the count by the rarity shares', () => {
    const result = sourceLemmas(input({ options: { count: '2', rarity: '5:1' } }));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(lines(result.list).every((line) => line.endsWith(' 5'))).toBe(true);
    expect(lines(result.list)).toHaveLength(2);
  });

  it('picks the same Lemmas for the same randomness and others for another', () => {
    const nouns = ['ар', 'бор', 'вир', 'гай', 'дуб', 'жар', 'зав', 'кій', 'лан', 'мур'];
    const headwords = nouns.map((lemma) => `${lemma}\tnoun:inanim:m:v_naz`).join('\n');
    const pick = (seed: number) => {
      const result = sourceLemmas(
        input({ headwords, options: { count: '3' }, random: seededRandom(seed) }),
      );
      if (!result.ok) throw new Error(result.errors.join('\n'));
      return result.list;
    };
    expect(pick(1)).toBe(pick(1));
    const lists = new Set([1, 2, 3, 4, 5, 6].map(pick));
    expect(lists.size).toBeGreaterThan(1);
  });

  it('reports the pool per rarity and part of speech, and any share the pool could not fill', () => {
    const result = sourceLemmas(input({ options: { count: '4', pos: 'adv:1' } }));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.pool).toEqual({
      2: { noun: 1, verb: 0, adj: 0, adv: 1 },
      3: { noun: 1, verb: 0, adj: 1, adv: 1 },
      4: { noun: 1, verb: 1, adj: 0, adv: 0 },
      5: { noun: 2, verb: 2, adj: 0, adv: 0 },
    });
    expect(lines(result.list).sort()).toEqual(['вельми ? 3', 'ґречно ? 2'].sort());
    expect(result.shortfall).toBe(2);
  });

  it.each([
    [{ count: 'many' }, /--count/],
    [{ count: '0' }, /--count/],
    [{ pos: 'noun:2,pronoun:1' }, /--pos.*pronoun/],
    [{ pos: 'noun' }, /--pos/],
    [{ rarity: '1:1' }, /--rarity.*1/],
    [{ letters: 'q' }, /--letters.*q/],
  ])('refuses bad options %o', (options, message) => {
    const result = sourceLemmas(input({ options }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toMatch(message);
  });
});
