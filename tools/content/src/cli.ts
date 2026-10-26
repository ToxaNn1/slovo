/**
 * Drafts and checks an Edition's content:
 *
 *   pnpm content new word|correction|idiom|synonym-row --edition <id>
 *   pnpm content edit <id or text> --edition <id>
 *   pnpm content retire <id> --edition <id>
 *   pnpm content check --edition <id>
 *
 * `new` drafts an Entry with a fresh id and `edit` finds an existing one;
 * either opens it in `$VISUAL`, else `$EDITOR`, else `vi`, and after each
 * save checks the content with the Language Pack build's rules and records
 * it, or prints the problems and offers to reopen the file. `retire` marks
 * an Entry retired and records the content. `check` checks the whole
 * Edition and writes nothing. `$SLOVO_EDITIONS_DIR` points the tool at another editions folder,
 * as the tests do.
 */
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';

import {
  EDITIONS_DIR,
  EditionFolderError,
  openEdition,
  type EditionFolder,
} from '@slovo/language-pack/edition';

import {
  checkEdition,
  editEntry,
  ENTRY_KINDS,
  newEntry,
  retireEntry,
  type ContentTool,
  type Editor,
  type EntryKind,
  type Terminal,
} from './content';

const USAGE = [
  'Usage: pnpm content new word|correction|idiom|synonym-row --edition <id>',
  '       pnpm content edit <id or text> --edition <id>',
  '       pnpm content retire <id> --edition <id>',
  '       pnpm content check --edition <id>',
].join('\n');

const editor: Editor = {
  open(path) {
    const command = process.env['VISUAL'] ?? process.env['EDITOR'] ?? 'vi';
    const quoted = `'${path.replaceAll("'", `'\\''`)}'`;
    const { status } = spawnSync(`${command} ${quoted}`, { shell: true, stdio: 'inherit' });
    if (status !== 0) {
      console.error(`The editor "${command}" exited with status ${String(status)}`);
    }
  },
};

const terminal: Terminal = {
  print: (line) => {
    console.log(line);
  },
  problem: (line) => {
    console.error(line);
  },
  async confirm(question) {
    const answer = await this.ask(question);
    return answer !== undefined && !/^n/i.test(answer.trim());
  },
  ask(question) {
    // One reader per question, so the editor has the terminal to itself in between.
    const reader = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      reader.on('close', () => {
        resolve(undefined);
      });
      reader.question(`${question} `, (answer) => {
        resolve(answer);
        reader.close();
      });
    });
  },
};

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { edition: { type: 'string' } },
  });
  const [command, ...rest] = positionals;
  const [argument] = rest;
  const kind = command === 'new' && rest.length === 1 ? entryKind(argument) : undefined;
  const known =
    (command === 'new' && kind !== undefined) ||
    ((command === 'edit' || command === 'retire') && rest.length === 1) ||
    (command === 'check' && rest.length === 0);
  if (!known || values.edition === undefined) {
    console.error(USAGE);
    return 2;
  }

  let edition: EditionFolder;
  try {
    edition = openEdition(process.env['SLOVO_EDITIONS_DIR'] ?? EDITIONS_DIR, values.edition);
  } catch (error) {
    if (!(error instanceof EditionFolderError)) throw error;
    console.error(error.message);
    return error.reason === 'unknown' ? 2 : 1;
  }
  const tool: ContentTool = { edition, editor, terminal, random: Math.random };
  if (kind !== undefined) return newEntry(kind, tool);
  if (command === 'edit') return editEntry(argument ?? '', tool);
  if (command === 'retire') return retireEntry(argument ?? '', tool);
  return checkEdition(tool);
}

function entryKind(name: string | undefined): EntryKind | undefined {
  return Object.keys(ENTRY_KINDS).find((kind): kind is EntryKind => kind === name);
}

process.exitCode = await main();
