#!/usr/bin/env node
// Dumps what the uk Edition already has, one line per item, to /tmp/have.txt:
// idiom expressions, correction forms, synonym-row dominants and members, tip titles and forms.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../editions/uk/content/", import.meta.url).pathname;
const read = (dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(root, dir, f), "utf8")));
const lines = [];
for (const i of read("idioms")) lines.push(`idiom\t${i.idiomType}\t${i.expression}`);
for (const c of read("corrections"))
  lines.push(`correction\t${c.correctionType}\t${c.nonStandardForm} -> ${c.standardEquivalents.join(", ")}`);
for (const r of read("synonym-rows"))
  lines.push(`row\t${r.dominant.text}\t${r.members.map((m) => m.text).join(", ")}`);
for (const t of read("tips")) lines.push(`tip\t${t.title}\t${t.nonStandardForm} -> ${t.standardForm}`);
writeFileSync("/tmp/have.txt", `${lines.join("\n")}\n`);
console.log(`${lines.length} lines in /tmp/have.txt`);
