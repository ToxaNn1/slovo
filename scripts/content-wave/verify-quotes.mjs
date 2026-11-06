// Usage: node scripts/content-wave/verify-quotes.mjs <field> <entry.json...>
// The gate of ADR 0080: the first 40 characters of <field> must appear in the
// text of the Entry's first source page, and the page must not be one goroh
// attributes to «Велика мовна модель» around that text. Prints one line per file.
import { readFileSync } from "node:fs";
const [field, ...files] = process.argv.slice(2);
const strip = (html) => html.replace(/<[^>]*>/g, " ").replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, " ");
for (const file of files) {
  const entry = JSON.parse(readFileSync(file, "utf8"));
  const url = entry.sources?.[0]?.url;
  const quote = String(entry[field] ?? "").replace(/\.$/, "").slice(0, 40).toLowerCase().replace(/\s+/g, "").replace(/[’ʼ]/g, "'");
  if (!url) { console.log(`NOURL ${file}`); continue; }
  const text = strip(await (await fetch(encodeURI(decodeURI(url)))).text()).toLowerCase().replace(/\s+/g, "").replace(/[’ʼ]/g, "'");
  const at = text.indexOf(quote);
  const llm = at >= 0 && text.slice(Math.max(0, at - 400), at).includes("Велика мовна модель");
  console.log(at < 0 ? `MISS ${file} :: ${quote}` : llm ? `LLM ${file}` : `ok ${file}`);
  await new Promise((r) => setTimeout(r, 2000));
}
