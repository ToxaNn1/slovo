#!/usr/bin/env node
// Downloads a book that osvita.ua serves page by page (list-N.html) and writes its
// paragraphs as plain text, one paragraph per line, prefixed by the page number.
// Usage: fetch-osvita.mjs <book url without list-N.html> <last page N> <out.txt>
//   e.g. fetch-osvita.mjs https://osvita.ua/school/literature/a/79209/ 58 /tmp/ad.txt
// Page 0 is the book url itself.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [base, last, out] = process.argv.slice(2);
if (!base || !last || !out) {
  console.error('usage: fetch-osvita.mjs <book url> <last page> <out.txt>');
  process.exit(2);
}
const entities = {
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  quot: '"',
  laquo: '«',
  raquo: '»',
  amp: '&',
  lt: '<',
  gt: '>',
  rsquo: '’',
  lsquo: '‘',
  hellip: '…',
  apos: "'",
};
const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/g, (m, e) => entities[e] ?? m);
const lines = [];
for (let n = 0; n <= Number(last); n++) {
  const url = n === 0 ? base : `${base}list-${n}.html`;
  const html = execFileSync('curl', ['-fsSL', '--max-time', '30', url], {
    maxBuffer: 16 * 1024 * 1024,
  }).toString('utf8');
  for (const m of html.matchAll(/<p>([\s\S]*?)(?=<p>|<\/p>|<div)/g)) {
    const text = decode(m[1].replace(/<[^>]*>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 0) lines.push(`${n}\t${text}`);
  }
}
writeFileSync(out, `${lines.join('\n')}\n`);
console.log(`${lines.length} paragraphs in ${out}`);
