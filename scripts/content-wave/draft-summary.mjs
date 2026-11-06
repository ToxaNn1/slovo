// One line per ready draft: id lemma category rarity examples-count definition start.
// Usage: node scripts/content-wave/draft-summary.mjs [drafts-dir]
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'tools/sourcing/review/drafts';
const rows = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
  .sort((a, b) => a.categoryId.localeCompare(b.categoryId) || a.rarity - b.rarity);
for (const w of rows) {
  const text = JSON.stringify(w);
  const flag = /мовна модель/i.test(text) ? ' LLM!' : '';
  const def = w.primaryDefinition.slice(0, 55);
  console.log(
    `${w.id} ${w.lemma} ${w.categoryId} ${w.rarity} e${(w.examples ?? []).length}${flag} ${def}`,
  );
}
