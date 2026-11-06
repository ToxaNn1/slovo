#!/usr/bin/env node
// Prints only the article text of a dictionary page, at most 2 KB.
// Usage: fetch-article.mjs <url> [filter] [skip]
//   filter: only blocks (goroh) or lines (other pages) containing this text, case-insensitive
//   skip:   skip this many output characters (to page through a long article)
// goroh.pp.ua: one line per article block, prefixed by its source; blocks from
// «Велика мовна модель» are hidden and only counted: they must not be quoted (ADR 0012).
// Other pages (ukrlib.com.ua, cp1251): plain text of the page body.
import { execFileSync } from "node:child_process";

const [url, filter = "", skip = "0"] = process.argv.slice(2);
if (!url) {
  console.error("usage: fetch-article.mjs <url> [filter] [skip]");
  process.exit(2);
}
const LIMIT = 2000;

const raw = execFileSync("curl", ["-sSL", "--max-time", "30", encodeURI(decodeURI(url))], {
  maxBuffer: 64 * 1024 * 1024,
});
const head = raw.subarray(0, 4096).toString("latin1").toLowerCase();
const charset = /charset=["']?(windows-1251|cp1251)/.test(head) ? "windows-1251" : "utf-8";
const html = new TextDecoder(charset).decode(raw);

const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", mdash: "—", ndash: "–", hellip: "…" };
const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => entities[n.toLowerCase()] ?? m);
const text = (s) =>
  decode(
    s
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<span class="show-examples_btn"[^>]*>[^<]*<\/span>/g, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t\r\f\v\u00a0]+/g, " ")
    .replace(/ *\n[\s]*/g, "\n")
    .trim();

const wanted = (s) => !filter || s.toLowerCase().includes(filter.toLowerCase());
let out = [];
const llm = [];

if (html.includes('class="article-block"')) {
  // Each source section ends with a source-info div naming the source.
  const parts = html.split(/<div class='source-info'[^>]*>([\s\S]*?)<\/div>/);
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const source = text(parts[i + 1]);
    const tag = source.includes("Велика мовна модель") ? "[LLM] " : "";
    for (const block of parts[i].split('class="article-block"').slice(1)) {
      const header = text((block.match(/<h2[\s\S]*?<\/h2>/) || [""])[0]).replace(/\n/g, " ");
      const senses = block
        .split('class="interpret list-item')
        .slice(1)
        .map((sense) => {
          const remark = text((sense.match(/<span class="interpret-remark">([\s\S]*?)<\/span>/) || ["", ""])[1]);
          const formula = text((sense.match(/<span class="interpret-formula">([\s\S]*?)<\/span>\s*(<span class="show|<div|$)/) || ["", ""])[1]);
          const examples = [...sense.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]).replace(/\n/g, " "));
          return `${remark ? `(${remark}) ` : ""}${formula}${examples.length ? ` ‖ ${examples.join(" ‖ ")}` : ""}`;
        });
      const body = senses.length ? senses.join(" | ") : text(block.replace(/<h2[\s\S]*?<\/h2>/, "")).replace(/\n/g, " ");
      const line = `${tag}{${source}} ${header} :: ${body}`;
      if (wanted(line)) (tag ? llm : out).push(line);
    }
  }
  if (llm.length) out.push(`[${llm.length} [LLM] blocks hidden]`);
  // Pages without blocks (Синонімія, Словозміна) fall through below.
}
if (!out.length) {
  const body = (html.match(/<div class="page-content"[\s\S]*/) || html.match(/<body[\s\S]*<\/body>/i) || [html])[0];
  out = text(body).split("\n").filter(wanted);
  if (html.includes("Велика мовна модель")) out.unshift("[page mentions «Велика мовна модель»: check the source of each part]");
}

const all = out.join("\n").slice(Number(skip));
console.log(all.length > LIMIT ? `${all.slice(0, LIMIT)}\n…[+${all.length - LIMIT} chars, skip=${Number(skip) + LIMIT}]` : all);
