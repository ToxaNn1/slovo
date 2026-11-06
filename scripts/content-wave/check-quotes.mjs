#!/usr/bin/env node
// Checks that a batch of new Tips quotes its book word for word (ADR 0012).
// Usage: check-quotes.mjs <array.json> <book.txt>
// book.txt: one paragraph per line, "<page>\t<text>" (as fetch-osvita.mjs writes it).
// title, nonStandardForm, standardForm, explanation, example.text and gameQuestion.rightAnswer
// must each be found in the book. Quote marks («» ") and apostrophes (’ ') are compared as one;
// a final period added after a quoted span is allowed. Prints the book page of each explanation
// and the explanation's length.
import { readFileSync } from 'node:fs';

const [file, book] = process.argv.slice(2);
if (!file || !book) {
  console.error('usage: check-quotes.mjs <array.json> <book.txt>');
  process.exit(2);
}
const norm = (s) =>
  s
    .replace(/[«»"“”„]/g, '"')
    .replace(/[’'ʼ]/g, "'")
    .replace(/‑/g, '-')
    .replace(/\s+/g, ' ');
const paragraphs = readFileSync(book, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const tab = line.indexOf('\t');
    return { page: Number(line.slice(0, tab)), text: norm(line.slice(tab + 1)) };
  });
const all = paragraphs.map((p) => p.text).join('\n');
const find = (s) => {
  const n = norm(s);
  return all.includes(n) || (n.endsWith('.') && all.includes(n.slice(0, -1)));
};
const pageOf = (s) => {
  const n = norm(s).replace(/\.$/, '');
  return paragraphs.find((p) => p.text.includes(n))?.page;
};
let bad = 0;
for (const tip of JSON.parse(readFileSync(file, 'utf8'))) {
  const fields = {
    title: tip.title,
    nonStandardForm: tip.nonStandardForm,
    standardForm: tip.standardForm,
    explanation: tip.explanation,
    example: tip.example?.text,
    rightAnswer: tip.gameQuestion.rightAnswer,
  };
  const missing = Object.entries(fields)
    .filter(([, v]) => v !== undefined && !find(v))
    .map(([k]) => k);
  if (missing.length > 0 || tip.explanation.length > 300) bad++;
  console.log(
    `${tip.title}\tpage ${pageOf(tip.explanation)}\t${tip.explanation.length}\t${missing.join(',') || 'ok'}`,
  );
}
process.exit(bad > 0 ? 1 : 0);
