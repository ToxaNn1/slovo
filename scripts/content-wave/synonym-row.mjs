#!/usr/bin/env node
// Builds Synonym Rows (without id) from goroh «Синонімія» pages, quoting the page:
// dominant and its Stress, the sense line as the meaning, each member with its own
// short note as the shade note (cross-references such as «те саме, що» are left out).
// Members goroh prints without a stress mark are kept
// only when they have one vowel. Links a member to a Word of the Edition by lemma.
// Usage: synonym-row.mjs <out.json> <word>:<sense>... e.g. synonym-row.mjs /tmp/rows.json дорога:1
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [out, ...specs] = process.argv.slice(2);
if (!out || !specs.length) {
  console.error('usage: synonym-row.mjs <out.json> <word>:<sense>...');
  process.exit(2);
}
const words = new URL('../../editions/uk/content/words/', import.meta.url).pathname;
const wordIds = new Map(
  readdirSync(words)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(words, f), 'utf8')))
    .map((w) => [w.lemma, w.id]),
);

const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '')
    .replace(/[\s ]+/g, ' ')
    .trim();
const VOWELS = 'аеєиіїоуюяАЕЄИІЇОУЮЯ';
// "доро́га" -> { text: "дорога", stress: [3] }; null when the stress is unknown.
const rowWord = (stressed) => {
  const text = [];
  const stress = [];
  for (const ch of stressed.normalize('NFC').replace(/[’ʼ]/g, "'")) {
    if (ch === '́') stress.push(text.length - 1);
    else text.push(ch);
  }
  const vowels = text.flatMap((ch, i) => (VOWELS.includes(ch) ? [i] : []));
  if (!stress.length && vowels.length === 1) stress.push(vowels[0]);
  return stress.length ? { text: text.join(''), stress } : null;
};

const rows = [];
for (const spec of specs) {
  const [word, sense = '1'] = spec.split(':');
  const html = execFileSync(
    'curl',
    ['-sSL', '--max-time', '30', encodeURI(`https://goroh.pp.ua/Синонімія/${word}`)],
    {
      maxBuffer: 64 * 1024 * 1024,
    },
  ).toString('utf8');
  if (html.includes('Велика мовна модель'))
    console.error(`${word}: page mentions «Велика мовна модель», check it`);
  const block = html.split('<div class="article-block">')[Number(sense)];
  if (!block) {
    console.error(`${word}: no sense ${sense}, skipped`);
    continue;
  }
  const head = block.match(
    /<h2[\s\S]*?<b>([\s\S]*?)<\/b>[\s\S]*?short-interpret">([\s\S]*?)<\/span>/,
  );
  if (!head) {
    console.error(`${word}:${sense} no row on the page, skipped`);
    continue;
  }
  const dominant = rowWord(decode(head[1]));
  const meaning = decode(head[2]).replace(/[;,:]+$/, '');
  const members = [];
  for (const item of block.split('<div class="list-item decimal">').slice(1)) {
    const member = rowWord(decode((item.match(/<a [^>]*>([\s\S]*?)<\/a>/) || ['', ''])[1]));
    if (!member || member.text === dominant.text || members.some((m) => m.text === member.text))
      continue;
    const note = decode((item.match(/short-interpret">([\s\S]*?)<\/span>/) || ['', ''])[1])
      .replace(/[.;,]+$/, '')
      .replace(/^(те саме, що|присл. до|зменш.|збільш.).*/, '');
    const wordId = wordIds.get(member.text);
    members.push({
      ...member,
      ...(wordId ? { wordId } : {}),
      ...(note && note.length <= 60 ? { shadeNote: note } : {}),
    });
  }
  rows.push({
    kind: 'synonymRow',
    dominant,
    meaning: meaning[0].toUpperCase() + meaning.slice(1) + (meaning.endsWith('.') ? '' : '.'),
    members: members.slice(0, 12),
    sources: [
      {
        title: `Горох. Синонімія: «${word}». Джерело: Цифрові лексикографічні системи української мови`,
        shortName: 'Горох',
        url: `https://goroh.pp.ua/Синонімія/${word}`,
      },
    ],
  });
  console.log(
    `${word}:${sense} ${dominant.text} — ${meaning} — ${members.length} members: ${members.map((m) => m.text).join(', ')}`.slice(
      0,
      220,
    ),
  );
}
writeFileSync(out, `${JSON.stringify(rows, null, 1)}\n`);
