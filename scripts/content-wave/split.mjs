#!/usr/bin/env node
// Splits one JSON array of new items into one file per item in editions/uk/content/<dir>/.
// Usage: split.mjs <dir> <prefix> <array.json>   e.g. split.mjs idioms i_ /tmp/idioms.json
// Each item gets a fresh id: <prefix> + 6 [a-z0-9], not in ids.json and not an existing file.
// Keeps "kind" first when present, then "id", then the item's own keys.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import { join } from "node:path";

const [dir, prefix, file] = process.argv.slice(2);
if (!dir || !prefix || !file) {
  console.error("usage: split.mjs <dir> <prefix> <array.json>");
  process.exit(2);
}
const root = new URL("../../editions/uk/content/", import.meta.url).pathname;
const taken = new Set(JSON.parse(readFileSync(join(root, "ids.json"), "utf8")));
const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
const freshId = () => {
  for (;;) {
    let id = prefix;
    for (let i = 0; i < 6; i++) id += alphabet[randomInt(alphabet.length)];
    if (!taken.has(id) && !existsSync(join(root, dir, `${id}.json`))) {
      taken.add(id);
      return id;
    }
  }
};

const items = JSON.parse(readFileSync(file, "utf8"));
for (const { kind, id: _ignored, ...rest } of items) {
  const id = freshId();
  const item = kind === undefined ? { id, ...rest } : { kind, id, ...rest };
  writeFileSync(join(root, dir, `${id}.json`), `${JSON.stringify(item, null, 2)}\n`);
}
console.log(`${items.length} files written to ${dir}/`);
