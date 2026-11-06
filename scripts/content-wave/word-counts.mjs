// Dumps every existing Lemma to /tmp/have.txt and prints Word counts per Category x rarity.
// Usage: node scripts/content-wave/word-counts.mjs [edition]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const edition = process.argv[2] ?? "uk";
const root = join("editions", edition);
const config = JSON.parse(readFileSync(join(root, "edition.json"), "utf8"));
const categories = config.categories.map((c) => c.id);
const dir = join(root, "content", "words");
const counts = new Map(categories.map((c) => [c, [0, 0, 0, 0, 0]]));
const lemmas = [];
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const word = JSON.parse(readFileSync(join(dir, file), "utf8"));
  lemmas.push(word.lemma);
  const row = counts.get(word.categoryId);
  if (row) row[word.rarity - 1] += 1;
}
writeFileSync("/tmp/have.txt", lemmas.sort().join("\n") + "\n");
console.log(`${lemmas.length} Lemmas -> /tmp/have.txt`);
console.log("category".padEnd(20) + "r1  r2  r3  r4  r5  total");
for (const [category, row] of counts) {
  const cells = row.map((n) => String(n).padEnd(4)).join("");
  console.log(category.padEnd(20) + cells + row.reduce((a, b) => a + b, 0));
}
