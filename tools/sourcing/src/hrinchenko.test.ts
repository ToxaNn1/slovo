import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  cachedHrinchenko,
  hrinchenkoGrammar,
  loadHrinchenko,
  onlyHrinchenkoHeadwords,
  parseHrinchenkoPage,
  type HrinchenkoScan,
} from './hrinchenko';

/** A column of a page as Tesseract reads it, accent marks misread and all. */
const PAGE = `Ворина, ни, ж. Жердь, употребляемая
для огорожи. Ми взяли ворину таку, як
у руку завтовшки, та довгу та рівну.
Пирят. у. З усього села ні жердини не
зосталося. Канев. у.

" Воріг, рога, м. Врагъ. Поглянь, Ма-
русю, на поріг. Нп.
Воріженько, ка, м. Ум. отъ воріг.

Ворітенька, ньок, мн. Ум. отъ ворота.
Ворожити, жу, жиш, гл. Гадать. Мир. ХРВ. 70.
Вороннє, нья, с. Соб. вороны. Шух. І. 76.
`;

describe('parseHrinchenkoPage', () => {
  it('reads each article as its headword, the rest of the article and its sigla', () => {
    const articles = parseHrinchenkoPage(PAGE);

    expect(articles.map((article) => article.headword)).toEqual([
      'ворина',
      'воріг',
      'воріженько',
      'ворітенька',
      'ворожити',
      'вороннє',
    ]);
    const [ворина, воріг] = articles;
    // A line break inside a word is joined, and the article is one line.
    expect(ворина?.gloss).toBe(
      'ни, ж. Жердь, употребляемая для огорожи. Ми взяли ворину таку, як у руку завтовшки, та довгу та рівну. Пирят. у. З усього села ні жердини не зосталося. Канев. у.',
    );
    expect(ворина?.sigla).toEqual(['Пирят. у.', 'Канев. у.']);
    expect(воріг?.gloss).toBe('рога, м. Врагъ. Поглянь, Марусю, на поріг. Нп.');
    expect(воріг?.sigla).toEqual(['Нп.']);
    expect(articles[4]?.sigla).toEqual(['Мир. ХРВ. 70.']);
    expect(articles[5]?.sigla).toEqual(['Шух. І. 76.']);
  });

  it('reads nothing from a page of front matter', () => {
    expect(
      parseHrinchenkoPage(
        'Макс. (1834). = Украинскія народныя пѣсни.\n\nМВ. І. = Повістки Марка Вовчка.\n',
      ),
    ).toEqual([]);
  });
});

describe('hrinchenkoGrammar', () => {
  it('reads the part of speech and gender from the label after the endings', () => {
    expect(hrinchenkoGrammar('ни, ж. Жердь.')).toEqual({
      partOfSpeech: 'noun',
      gender: 'feminine',
    });
    expect(hrinchenkoGrammar('рога, м. Врагъ.')).toEqual({
      partOfSpeech: 'noun',
      gender: 'masculine',
    });
    expect(hrinchenkoGrammar('нья, с. Соб. вороны.')).toEqual({
      partOfSpeech: 'noun',
      gender: 'neuter',
    });
    expect(hrinchenkoGrammar('ньок, мн. Ум. отъ ворота.')).toEqual({
      partOfSpeech: 'noun',
      gender: 'plural-only',
    });
    expect(hrinchenkoGrammar('жу, жиш, гл. Гадать.')).toEqual({ partOfSpeech: 'verb' });
    expect(hrinchenkoGrammar('нар. Скоро.')).toEqual({ partOfSpeech: 'adverb' });
    expect(hrinchenkoGrammar('а, е. Черный.')).toEqual({});
  });
});

describe('onlyHrinchenkoHeadwords', () => {
  it('keeps the Lemma forms of the headword list that Грінченко has, in any letter case', () => {
    const headwords =
      'ворина\tnoun:inanim:f:v_naz\nвода\tnoun:inanim:f:v_naz\nворожити\tverb:imperf:inf\n';
    const index = new Map([
      ['ворина', [{ headword: 'ворина', gloss: 'ни, ж.', sigla: [] }]],
      ['ворожити', [{ headword: 'ворожити', gloss: 'гл.', sigla: [] }]],
    ]);

    expect(onlyHrinchenkoHeadwords(headwords, index)).toBe(
      'ворина\tnoun:inanim:f:v_naz\nворожити\tverb:imperf:inf\n',
    );
  });
});

/** The end of the Б section and the start of В, with the bold Б of most articles read as В. */
const BE_PAGES = [
  'Бабисько, ка, с. Ув. отъ баба.\n\nВабити, блю, биш, гл. Быть повивальной бабкой.\n\nБабка, ки, ж. Бабушка.\n',
  'Валакливий, а, е. Разговорчивый.\n\nБалакун, на, м. Говорунъ.\n\nВуян, на, м. Буянъ.\n',
];
const VE_PAGE =
  'В.\n\nВабити, блю, биш, гл. Манить.\n\nВада, ди, ж. Недостатокъ.\n\nВаги, ваг, мн. Весы.\n';

describe('loadHrinchenko', () => {
  const pdf = new TextEncoder().encode('%PDF a scan');
  const scan: HrinchenkoScan = {
    id: 'test-scan',
    url: 'https://archive.org/download/test-scan/test-scan.pdf',
    sha256: createHash('sha256').update(pdf).digest('hex'),
  };

  function setup() {
    const cacheDir = mkdtempSync(join(tmpdir(), 'slovo-hrinchenko-'));
    const downloads: string[] = [];
    const readings: string[] = [];
    const options = {
      cacheDir,
      download: (url: string) => {
        downloads.push(url);
        return Promise.resolve(pdf);
      },
      readPages: (file: string) => {
        readings.push(file);
        return Promise.resolve([PAGE, 'Вороний, а, е. Черный.\n']);
      },
      log: () => undefined,
    };
    return { cacheDir, downloads, readings, options };
  }

  it('builds the index once from the pinned scan and reads it from the cache after', async () => {
    const { cacheDir, downloads, readings, options } = setup();
    expect(cachedHrinchenko(cacheDir, [scan])).toBeUndefined();

    const index = await loadHrinchenko(options, [scan]);
    const again = await loadHrinchenko(options, [scan]);

    expect(index.get('ворина')?.[0]?.sigla).toEqual(['Пирят. у.', 'Канев. у.']);
    expect(index.get('вороний')?.[0]?.gloss).toBe('а, е. Черный.');
    expect(again).toEqual(index);
    expect(cachedHrinchenko(cacheDir, [scan])).toEqual(index);
    expect(downloads).toEqual([scan.url]);
    expect(readings).toHaveLength(1);
    expect(readdirSync(join(cacheDir, 'lemmas'))).toEqual([
      `hrinchenko-v2-${scan.sha256.slice(0, 12)}.tsv`,
    ]);
  });

  it('gives back the Б that OCR read as В, up to where the dictionary reaches В', async () => {
    const { options } = setup();

    const index = await loadHrinchenko(
      { ...options, readPages: () => Promise.resolve([...BE_PAGES, VE_PAGE]) },
      [scan],
    );

    expect([...index.keys()]).toEqual([
      'бабисько',
      'бабити',
      'бабка',
      'балакливий',
      'балакун',
      'буян',
      'вабити',
      'вада',
      'ваги',
    ]);
    expect(index.get('бабити')?.[0]?.gloss).toBe('блю, биш, гл. Быть повивальной бабкой.');
    expect(index.get('вабити')?.[0]?.gloss).toBe('блю, биш, гл. Манить.');
  });

  it('builds the index again over one an earlier parser left in the cache', async () => {
    const { cacheDir, readings, options } = setup();
    mkdirSync(join(cacheDir, 'lemmas'));
    writeFileSync(
      join(cacheDir, 'lemmas', `hrinchenko-${scan.sha256.slice(0, 12)}.tsv`),
      'вабити\tблю, гл. Быть повивальной бабкой.\t\n',
    );

    const index = await loadHrinchenko(options, [scan]);

    expect(readings).toHaveLength(1);
    expect(index.has('ворина')).toBe(true);
  });

  it('refuses a scan whose SHA-256 is not the pinned one, and keeps nothing of it', async () => {
    const { cacheDir, options } = setup();

    await expect(loadHrinchenko(options, [{ ...scan, sha256: '0'.repeat(64) }])).rejects.toThrow(
      /not the pinned/,
    );
    expect(existsSync(join(cacheDir, 'lemmas'))).toBe(false);
    expect(existsSync(join(cacheDir, 'hrinchenko', 'test-scan.pdf'))).toBe(false);
  });
});
