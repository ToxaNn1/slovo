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
    labelled: new Set(),
    inEsum: () => Promise.resolve(false),
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
  it('keeps only common nouns, verbs, adjectives and adverbs of bands 2–5, in the source:words format', async () => {
    const result = await sourceLemmas(input({ options: { count: '100' } }));
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

  it('keeps rare and archaic Lemmas, an archaic one a rarity higher (at most 5), and drops dialect ones', async () => {
    const result = await sourceLemmas(input({ options: { count: '100' } }));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const picked = lines(result.list);
    expect(picked).toContain('гуторити ? 5');
    expect(picked).toContain('перст ? 4');
    expect(picked).toContain('вуй ? 5');
    expect(picked.map((line) => line.split(' ')[0])).not.toContain('ґазда');
  });

  it('gives an archaic Lemma the rarity that keeps it out of band 1 a place in band 2', async () => {
    const result = await sourceLemmas(
      input({
        headwords: 'перст\tnoun:inanim:m:v_naz:arch',
        zipf: () => 3.1,
        options: { count: '100' },
      }),
    );
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(lines(result.list)).toEqual(['перст ? 2']);
  });

  it('does not raise the rarity of a Lemma with a form that is not archaic', async () => {
    const result = await sourceLemmas(input({ options: { count: '100', letters: 'в', pos: 'adv:1' } }));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(lines(result.list)).toEqual(['вельми ? 3']);
  });

  it('notes the part of speech and the Zipf on each line, after a comment sign', async () => {
    const result = await sourceLemmas(input({ options: { count: '100', letters: 'м' } }));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.list).toContain('мжичка ? 3 # noun, Zipf 1.62');
  });

  it('drops the Lemmas the Edition already has, stressed or not, and the reflexive pair of one', async () => {
    const result = await sourceLemmas(
      input({ existingLemmas: ['Бабак', 'мжи́чка', 'бити'], options: { count: '100' } }),
    );
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const lemmas = lines(result.list).map((line) => line.split(' ')[0]);
    expect(lemmas).not.toContain('бабак');
    expect(lemmas).not.toContain('мжичка');
    expect(lemmas).not.toContain('битися');
    expect(lemmas).toContain('дзвонар');
  });

  it('drops the Lemmas of the exclude lists, by their first field', async () => {
    const result = await sourceLemmas(
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

  it('keeps only the Lemmas that start with the given letters', async () => {
    const result = await sourceLemmas(input({ options: { count: '100', letters: 'ґ,м' } }));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(
      lines(result.list)
        .map((line) => line.split(' ')[0])
        .sort(),
    ).toEqual(['мжичка', 'ґречний', 'ґречно'].sort());
  });

  it('splits the count by the part-of-speech shares', async () => {
    const result = await sourceLemmas(input({ options: { count: '2', pos: 'verb:1,adv:1' } }));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const picked = lines(result.list);
    expect(picked).toHaveLength(2);
    expect(picked).toContain('ґречно ? 2');
    expect(
      picked.filter((line) => ['бринькати', 'битися'].includes(line.split(' ')[0] ?? '')),
    ).toHaveLength(1);
  });

  it('splits the count by the rarity shares', async () => {
    const result = await sourceLemmas(input({ options: { count: '2', rarity: '5:1' } }));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(lines(result.list).every((line) => line.endsWith(' 5'))).toBe(true);
    expect(lines(result.list)).toHaveLength(2);
  });

  it('picks the same Lemmas for the same randomness and others for another', async () => {
    const nouns = ['ар', 'бор', 'вир', 'гай', 'дуб', 'жар', 'зав', 'кій', 'лан', 'мур'];
    const headwords = nouns.map((lemma) => `${lemma}\tnoun:inanim:m:v_naz`).join('\n');
    const pick = async (seed: number) => {
      const result = await sourceLemmas(
        input({ headwords, options: { count: '3' }, random: seededRandom(seed) }),
      );
      if (!result.ok) throw new Error(result.errors.join('\n'));
      return result.list;
    };
    expect(await pick(1)).toBe(await pick(1));
    const lists = new Set(await Promise.all([1, 2, 3, 4, 5, 6].map(pick)));
    expect(lists.size).toBeGreaterThan(1);
  });

  it('reports the pool per rarity and part of speech, and any share the pool could not fill', async () => {
    const result = await sourceLemmas(input({ options: { count: '4', pos: 'adv:1' } }));
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

  it('leaves out productive derivatives whose base is a Word or at least as frequent', async () => {
    const headwords = [
      'читати\tverb:imperf:inf',
      'читання\tnoun:inanim:n:v_naz',
      'варити\tverb:imperf:inf',
      'варення\tnoun:inanim:n:v_naz',
      'носити\tverb:imperf:inf',
      'носіння\tnoun:inanim:n:v_naz',
      'мити\tverb:imperf:inf',
      'миття\tnoun:inanim:n:v_naz',
      'сміливий\tadj:m:v_naz',
      'сміливість\tnoun:inanim:f:v_naz',
      'синій\tadj:m:v_naz',
      'синість\tnoun:inanim:f:v_naz',
      'швидкий\tadj:m:v_naz',
      'швидко\tadv',
      'бринькати\tverb:imperf:inf',
      'бринькатися\tverb:imperf:inf:rev',
      'допомога\tnoun:inanim:f:v_naz',
      'взаємодопомога\tnoun:inanim:f:v_naz',
      'мініпекарня\tnoun:inanim:f:v_naz',
      'пекарня\tnoun:inanim:f:v_naz',
      'соцький\tnoun:anim:m:v_naz',
      'Полтава\tnoun:inanim:f:v_naz:prop:geo',
      'полтавський\tadj:m:v_naz',
      'брат\tnoun:anim:m:v_naz',
      'Братськ\tnoun:inanim:m:v_naz:prop:geo',
      'братський\tadj:m:v_naz',
      'гуторити\tverb:imperf:inf',
      'гуторення\tnoun:inanim:n:v_naz',
      'знамення\tnoun:inanim:n:v_naz',
    ].join('\n');
    const zipf: Readonly<Record<string, number>> = { гуторення: 0.5, читати: 4 };
    const result = await sourceLemmas(
      input({
        headwords,
        zipf: (lemma) => zipf[lemma] ?? 0,
        existingLemmas: ['варити'],
        options: { count: '100' },
      }),
    );
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const lemmas = lines(result.list).map((line) => line.split(' ')[0]);
    for (const derivative of [
      'читання',
      'варення',
      'носіння',
      'миття',
      'сміливість',
      'синість',
      'швидко',
      'бринькатися',
      'взаємодопомога',
      'мініпекарня',
      'полтавський',
    ]) {
      expect(lemmas).not.toContain(derivative);
    }
    // Kept: a derivative more frequent than its base, a Lemma whose base is
    // no Lemma, and an adjective of a common noun.
    for (const kept of ['гуторення', 'знамення', 'соцький', 'братський', 'бринькати', 'носити']) {
      expect(lemmas).toContain(kept);
    }
    expect(result.derivatives).toBe(11);
  });

  it('strikes an archaic Lemma that is another Lemma or a Word in an old spelling', async () => {
    const headwords = [
      'ґустовно\tadv:arch',
      'густовно\tadv',
      'оріх\tnoun:inanim:m:v_naz:arch',
      'горіх\tnoun:inanim:m:v_naz',
      'енот\tnoun:anim:m:v_naz:arch',
      'перст\tnoun:inanim:m:v_naz:arch',
      'вуй\tnoun:anim:m:v_naz:arch',
    ].join('\n');
    const result = await sourceLemmas(
      input({ headwords, existingLemmas: ['єнот'], options: { count: '100' } }),
    );
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(lines(result.list).map((line) => line.split(' ')[0]).sort()).toEqual(
      ['густовно', 'горіх', 'перст', 'вуй'].sort(),
    );
  });

  it('ranks candidates by evidence: archaic and labelled by Wiktionary first', async () => {
    const nouns = ['ар', 'бор', 'вир', 'гай', 'дуб', 'жар', 'зав', 'кій', 'лан', 'мур'];
    const headwords = [
      ...nouns.map((lemma) => `${lemma}\tnoun:inanim:m:v_naz`),
      'перст\tnoun:inanim:m:v_naz:arch',
    ].join('\n');
    for (const seed of [1, 2, 3, 4, 5]) {
      const result = await sourceLemmas(
        input({
          headwords,
          zipf: () => 0,
          labelled: new Set(['лан']),
          options: { count: '2', rarity: '5:1' },
          random: seededRandom(seed),
        }),
      );
      if (!result.ok) throw new Error(result.errors.join('\n'));
      expect(lines(result.list).map((line) => line.split(' ')[0])).toEqual(['лан', 'перст']);
    }
  });

  it('ranks a Lemma that ЕСУМ lists above one it does not', async () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const result = await sourceLemmas(
        input({
          headwords: 'ар\tnoun:inanim:m:v_naz\nдуб\tnoun:inanim:m:v_naz',
          inEsum: (lemma) => Promise.resolve(lemma === 'дуб'),
          options: { count: '1' },
          random: seededRandom(seed),
        }),
      );
      if (!result.ok) throw new Error(result.errors.join('\n'));
      expect(lines(result.list)).toEqual(['дуб ? 5']);
    }
  });

  it('asks ЕСУМ only about a shortlist of each cell, twice the lines it picks', async () => {
    const nouns = ['ар', 'бор', 'вир', 'гай', 'дуб', 'жар', 'зав', 'кій', 'лан', 'мур'];
    const asked: string[] = [];
    const result = await sourceLemmas(
      input({
        headwords: nouns.map((lemma) => `${lemma}\tnoun:inanim:m:v_naz`).join('\n'),
        inEsum: (lemma) => {
          asked.push(lemma);
          return Promise.resolve(false);
        },
        options: { count: '2', rarity: '5:1' },
      }),
    );
    expect(result.ok).toBe(true);
    expect(asked).toHaveLength(4);
  });

  it('notes the evidence of each line after its Zipf', async () => {
    const result = await sourceLemmas(
      input({
        headwords: 'перст\tnoun:inanim:m:v_naz:arch\nдуб\tnoun:inanim:m:v_naz',
        zipf: () => 0,
        labelled: new Set(['перст']),
        inEsum: () => Promise.resolve(true),
        options: { count: '2' },
      }),
    );
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.list).toContain('перст ? 5 # noun, Zipf 0.00, arch, Wiktionary, ЕСУМ');
    expect(result.list).toContain('дуб ? 5 # noun, Zipf 0.00, ЕСУМ');
  });

  it.each([
    [{ count: 'many' }, /--count/],
    [{ count: '0' }, /--count/],
    [{ pos: 'noun:2,pronoun:1' }, /--pos.*pronoun/],
    [{ pos: 'noun' }, /--pos/],
    [{ rarity: '1:1' }, /--rarity.*1/],
    [{ letters: 'q' }, /--letters.*q/],
  ])('refuses bad options %o', async (options, message) => {
    const result = await sourceLemmas(input({ options }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toMatch(message);
  });
});
