#!/usr/bin/env node
/**
 * Removes the footer a cloud session appends to a pull request body (ADR 0100),
 * so the attribution check of `commitlint.yml` reads the body without it.
 *
 *   node scripts/strip-pr-footer.mjs < body.md > clean.md
 *
 * A footer is a line that is nothing but "Generated with/by Claude Code", as
 * plain text or a link, in italics or after the robot emoji. The blank lines
 * and the one `---` separator right before it go with it. Every other line,
 * any other AI attribution included, stays; a body without a footer comes out
 * byte for byte.
 */
import { readFileSync } from 'node:fs';

const FOOTER = /^(?:🤖\s*)?_?Generated (?:with|by) (?:\[Claude Code\]\([^()\s]*\)|Claude Code)_?$/i;

/** `body` without its footer lines. */
function stripFooter(body) {
  const eol = body.includes('\r\n') ? '\r\n' : '\n';
  const endsWithEol = /\r?\n$/.test(body);
  const lines = body.split(/\r?\n/);
  if (endsWithEol) lines.pop();

  const kept = [];
  const dropBlanks = () => {
    while (kept.length > 0 && kept.at(-1).trim() === '') kept.pop();
  };
  let stripped = false;
  for (const line of lines) {
    if (!FOOTER.test(line.trim())) {
      kept.push(line);
      continue;
    }
    stripped = true;
    dropBlanks();
    if (kept.at(-1)?.trim() === '---') {
      kept.pop();
      dropBlanks();
    }
  }
  if (!stripped) return body;
  dropBlanks();
  return kept.length === 0 ? '' : kept.join(eol) + (endsWithEol ? eol : '');
}

process.stdout.write(stripFooter(readFileSync(0, 'utf8')));
