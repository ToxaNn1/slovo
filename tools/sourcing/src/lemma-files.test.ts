import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync, gzipSync } from 'node:zlib';

import { describe, expect, it, onTestFinished } from 'vitest';

import { loadHeadwords, loadWiktionaryLabels } from './lemma-sources';
import { headwordList } from './morfologik';
import { readWordfreq, zipfOf } from './wordfreq';
import { readZipEntry } from './zip';

const utf8 = (text: string) => Buffer.from(text, 'utf8');

/**
 * A CFSA2 automaton holding the given byte sequences, as morfologik writes
 * it: explicit labels, except the mapped bytes, which go through the label
 * table, and an explicit target address on every arc (two-byte v-codes).
 */
function cfsa2(sequences: readonly Uint8Array[], mapped: readonly number[]): Uint8Array {
  interface Arc {
    readonly child: Map<number, Arc>;
    final: boolean;
  }
  const root = new Map<number, Arc>();
  for (const sequence of sequences) {
    let node = root;
    sequence.forEach((byte, index) => {
      const arc = node.get(byte) ?? { child: new Map<number, Arc>(), final: false };
      node.set(byte, arc);
      if (index === sequence.length - 1) arc.final = true;
      node = arc.child;
    });
  }
  const arcSize = (byte: number) => (mapped.includes(byte) ? 1 : 2) + 2;
  const nodes: Map<number, Arc>[] = [];
  const offsets = new Map<Map<number, Arc>, number>();
  let position = 4;
  const queue = [root];
  for (let node = queue.shift(); node !== undefined; node = queue.shift()) {
    nodes.push(node);
    offsets.set(node, position);
    for (const [byte, arc] of node) {
      position += arcSize(byte);
      if (arc.child.size > 0) queue.push(arc.child);
    }
  }
  const vint = (value: number) => [0x80 | (value & 0x7f), (value >> 7) & 0x7f];
  const arcs: number[] = [0x40, 0, ...vint(offsets.get(root) ?? 0)];
  for (const node of nodes) {
    const entries = [...node].sort(([a], [b]) => a - b);
    entries.forEach(([byte, arc], index) => {
      const label = mapped.indexOf(byte) + 1;
      arcs.push((index === entries.length - 1 ? 0x40 : 0) | (arc.final ? 0x20 : 0) | label);
      if (label === 0) arcs.push(byte);
      arcs.push(...vint(arc.child.size > 0 ? (offsets.get(arc.child) ?? 0) : 0));
    });
  }
  return Uint8Array.from([
    ...utf8('\\fsa'),
    0xc6,
    0x00,
    0x07,
    mapped.length + 1,
    0,
    ...mapped,
    ...arcs,
  ]);
}

/** A morfologik entry: the form, the SUFFIX-encoded Lemma and the tags. */
function entry(form: string, cut: number, append: Uint8Array | string, tags: string): Uint8Array {
  return Buffer.concat([
    utf8(form),
    utf8('+'),
    Uint8Array.of((cut + 65) & 0xff),
    typeof append === 'string' ? utf8(append) : append,
    utf8('+'),
    utf8(tags),
  ]);
}

describe('headwordList', () => {
  it('lists the Lemma forms of nouns, verbs, adjectives and adverbs with their tags', () => {
    const dict = cfsa2(
      [
        entry('мжичка', 0, '', 'noun:inanim:f:v_naz'),
        // мжички → мжичка: drop the last byte of «и», append the last byte of «а».
        entry('мжички', 1, Uint8Array.of(0xb0), 'noun:inanim:f:v_rod'),
        entry('бриньчу', 255, 'бринькати', 'verb:imperf:pres:s:1'),
        entry('бринькати', 0, '', 'verb:imperf:inf'),
        entry('ґречно', 0, '', 'adv'),
        entry('ой', 0, '', 'intj'),
      ],
      [0x2b],
    );
    expect(headwordList(dict).split('\n').sort()).toEqual(
      ['бринькати\tverb:imperf:inf', 'мжичка\tnoun:inanim:f:v_naz', 'ґречно\tadv'].sort(),
    );
  });

  it('refuses a file that is no CFSA2 automaton', () => {
    expect(() => headwordList(utf8('PK\u0003\u0004'))).toThrow(/CFSA2/);
  });
});

/** A zip archive with the given files, the first deflated, the rest stored. */
function zip(files: readonly { name: string; data: string | Uint8Array }[]): Uint8Array {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  files.forEach(({ name, data }, index) => {
    const raw = typeof data === 'string' ? utf8(data) : Buffer.from(data);
    const body = index === 0 ? deflateRawSync(raw) : raw;
    const method = index === 0 ? 8 : 0;
    const nameBytes = utf8(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(method, 10);
    record.writeUInt32LE(body.length, 20);
    record.writeUInt32LE(raw.length, 24);
    record.writeUInt16LE(nameBytes.length, 28);
    record.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, body);
    central.push(record, nameBytes);
    offset += local.length + nameBytes.length + body.length;
  });
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

describe('readZipEntry', () => {
  const archive = zip([
    { name: 'org/uk/ukrainian.dict', data: 'deflated bytes' },
    { name: 'README', data: 'stored bytes' },
  ]);

  it('reads a deflated and a stored entry by name', () => {
    expect(Buffer.from(readZipEntry(archive, 'org/uk/ukrainian.dict')).toString()).toBe(
      'deflated bytes',
    );
    expect(Buffer.from(readZipEntry(archive, 'README')).toString()).toBe('stored bytes');
  });

  it('names the entry it cannot find', () => {
    expect(() => readZipEntry(archive, 'missing.txt')).toThrow(/missing\.txt/);
  });
});

/** A MessagePack value: arrays, maps, strings and small integers only. */
function msgpack(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (typeof value === 'string') {
    const bytes = [...utf8(value)];
    return bytes.length < 32 ? [0xa0 | bytes.length, ...bytes] : [0xd9, bytes.length, ...bytes];
  }
  if (Array.isArray(value)) {
    const items = value.flatMap(msgpack);
    return value.length < 16
      ? [0x90 | value.length, ...items]
      : [0xdc, value.length >> 8, value.length & 0xff, ...items];
  }
  const entries = Object.entries(value as Record<string, unknown>);
  return [
    0x80 | entries.length,
    ...entries.flatMap(([key, item]) => [...msgpack(key), ...msgpack(item)]),
  ];
}

describe('readWordfreq', () => {
  // wordfreq's cBpack: a header, then one bucket per centibel below 1, so
  // bucket i holds the words of Zipf 9 − i/100.
  const buckets: string[][] = Array.from({ length: 800 }, () => []);
  buckets[410] = ['вода'];
  buckets[738] = ['мжичка', "м'ята"];
  const file = gzipSync(Uint8Array.from(msgpack([{ format: 'cB', version: 1 }, ...buckets])));

  it('gives each word the Zipf of its bucket, and 0 to a word it lacks', () => {
    const frequencies = readWordfreq(file);
    expect(zipfOf(frequencies, 'вода')).toBe(4.9);
    expect(zipfOf(frequencies, 'Мжичка')).toBe(1.62);
    expect(zipfOf(frequencies, 'дзвонар')).toBe(0);
  });

  it('finds a word whatever apostrophe it is written with', () => {
    expect(zipfOf(readWordfreq(file), 'мʼята')).toBe(1.62);
  });

  it('refuses a file of another format', () => {
    const other = gzipSync(Uint8Array.from(msgpack([{ format: 'xy', version: 1 }])));
    expect(() => readWordfreq(other)).toThrow(/cB/);
  });
});

describe('loadHeadwords', () => {
  const archive = zip([
    {
      name: 'uk/ukrainian.dict',
      data: cfsa2([entry('мжичка', 0, '', 'noun:inanim:f:v_naz')], []),
    },
  ]);
  const source = {
    url: 'https://example.test/dict-1.0.jar',
    sha256: createHash('sha256').update(archive).digest('hex'),
    entry: 'uk/ukrainian.dict',
  };

  it('downloads the dictionary once and reads it from the cache after', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'slovo-lemmas-'));
    onTestFinished(() => {
      rmSync(cacheDir, { recursive: true, force: true });
    });
    const urls: string[] = [];
    const options = {
      cacheDir,
      download: (url: string) => {
        urls.push(url);
        return Promise.resolve(archive);
      },
      log: () => undefined,
    };
    expect(await loadHeadwords(options, source)).toBe('мжичка\tnoun:inanim:f:v_naz');
    expect(await loadHeadwords(options, source)).toBe('мжичка\tnoun:inanim:f:v_naz');
    expect(urls).toEqual([source.url]);
  });

  it('refuses a download whose SHA-256 is not the pinned one', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'slovo-lemmas-'));
    onTestFinished(() => {
      rmSync(cacheDir, { recursive: true, force: true });
    });
    const options = {
      cacheDir,
      download: () => Promise.resolve(utf8('something else')),
      log: () => undefined,
    };
    await expect(loadHeadwords(options, source)).rejects.toThrow(/SHA-256/);
  });
});

describe('loadWiktionaryLabels', () => {
  /** A table dump as MediaWiki writes it: `INSERT INTO … VALUES` and rows with escaped strings. */
  const dump = (table: string, rows: readonly string[]) =>
    gzipSync(
      Buffer.concat([
        utf8(`-- MySQL dump\nCREATE TABLE \`${table}\` (\n  \`x\` int\n);\n`),
        utf8(`INSERT INTO \`${table}\` VALUES\n`),
        Buffer.concat(
          rows.map((row, at) =>
            Buffer.concat([utf8(row), utf8(at === rows.length - 1 ? ';\n' : ',\n')]),
          ),
        ),
      ]),
    );
  const pinned = (url: string, bytes: Uint8Array) => ({
    url,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  const files = {
    page: dump('page', [
      "(1,0,'перст',0,0,0.5,'20261101000000',NULL,1,10,'wikitext',NULL)",
      "(2,0,'вуй',0,0,0.5,'20261101000000',NULL,1,10,'wikitext',NULL)",
      "(3,0,'кінь',0,0,0.5,'20261101000000',NULL,1,10,'wikitext',NULL)",
      "(4,14,'Застарілі_вирази/uk',0,0,0.5,'20261101000000',NULL,1,10,'wikitext',NULL)",
      "(5,0,'старий_як_світ',0,0,0.5,'20261101000000',NULL,1,10,'wikitext',NULL)",
    ]),
    linktarget: dump('linktarget', [
      "(10,14,'Застарілі_вирази/uk')",
      "(11,14,'Діалектні_вирази/uk')",
      "(12,14,'Іменники/uk')",
    ]),
    // Sort keys are binary: a quote, a backslash and bytes that are no UTF-8.
    categorylinks: Buffer.concat([
      dump('categorylinks', [
        "(1,'\\'r\\\\F\\0','2025-06-20 16:22:36','','page',1,10)",
        "(2,'x','2025-06-20 16:22:36','','page',1,11)",
        "(3,'x','2025-06-20 16:22:36','','page',1,12)",
        "(5,'x','2025-06-20 16:22:36','','page',1,10)",
        "(4,'x','2025-06-20 16:22:36','','subcat',1,10)",
      ]),
    ]),
  };
  const source = {
    date: '20261101',
    page: pinned('https://example.test/page.sql.gz', files.page),
    linktarget: pinned('https://example.test/linktarget.sql.gz', files.linktarget),
    categorylinks: pinned('https://example.test/categorylinks.sql.gz', files.categorylinks),
    categories: ['Застарілі_вирази/uk', 'Діалектні_вирази/uk'],
  };
  const byUrl: Record<string, Uint8Array> = {
    [source.page.url]: files.page,
    [source.linktarget.url]: files.linktarget,
    [source.categorylinks.url]: files.categorylinks,
  };

  it('lists the pages in the labelling categories, once, from the cache after', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'slovo-lemmas-'));
    onTestFinished(() => {
      rmSync(cacheDir, { recursive: true, force: true });
    });
    const urls: string[] = [];
    const options = {
      cacheDir,
      download: (url: string) => {
        urls.push(url);
        const bytes = byUrl[url];
        return bytes === undefined ? Promise.reject(new Error(url)) : Promise.resolve(bytes);
      },
      log: () => undefined,
    };
    const labelled = await loadWiktionaryLabels(options, source);
    expect([...labelled].sort()).toEqual(['вуй', 'перст', 'старий як світ'].sort());
    expect([...(await loadWiktionaryLabels(options, source))].sort()).toEqual([...labelled].sort());
    expect(urls.sort()).toEqual(Object.keys(byUrl).sort());
  });

  it('refuses a dump file whose SHA-256 is not the pinned one', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'slovo-lemmas-'));
    onTestFinished(() => {
      rmSync(cacheDir, { recursive: true, force: true });
    });
    const options = {
      cacheDir,
      download: () => Promise.resolve(utf8('something else')),
      log: () => undefined,
    };
    await expect(loadWiktionaryLabels(options, source)).rejects.toThrow(/SHA-256/);
  });
});
