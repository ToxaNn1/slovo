/**
 * Drafts and checks an Edition's content:
 *
 *   pnpm content new word|correction|idiom|synonym-row|tip --edition <id>
 *   pnpm content edit <id or text> --edition <id>
 *   pnpm content retire <id> --edition <id>
 *   pnpm content check --edition <id>
 *   pnpm content have --edition <id> [--kind <kind>]
 *   pnpm content counts --edition <id>
 *   pnpm content import <kind> <array.json | drafts folder> --edition <id> [--no-record]
 *   pnpm content verify <files, ids or folders> | --changed <ref> --edition <id> [--book <file>]
 *
 * `new` drafts an Entry with a fresh id and `edit` finds an existing one;
 * either opens it in `$VISUAL`, else `$EDITOR`, else `vi`, and after each
 * save checks the content with the Language Pack build's rules and records
 * it, or prints the problems and offers to reopen the file. `retire` marks
 * an Entry retired and records the content. `check` checks the whole
 * Edition and writes nothing. `have` and `counts` print what the Edition
 * has (./have.ts). `import` writes a JSON array of new Entries, or a folder of
 * ready drafts, one file per Entry, then checks and records the content as
 * `new` does. `verify` checks quotes against their source pages (./verify.ts).
 * `$SLOVO_EDITIONS_DIR` points the tool at another editions folder,
 * as the tests do.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';

import {
  defaultCacheDir,
  fetchPage,
  POLITE_INTERVAL_MS,
  PoliteClient,
  systemClock,
} from '@slovo/sourcing';

import {
  EDITIONS_DIR,
  EditionFolderError,
  openEdition,
  type EditionFolder,
} from '@slovo/language-pack/edition';

import {
  checkEdition,
  editEntry,
  entryKind,
  newEntry,
  retireEntry,
  type ContentTool,
  type Editor,
  type Terminal,
} from './content';
import { listContent } from './have';
import { importEntries } from './import';
import { verifyEntries } from './verify';

const USAGE = [
  'Usage: pnpm content new word|correction|idiom|synonym-row|tip --edition <id>',
  '       pnpm content edit <id or text> --edition <id>',
  '       pnpm content retire <id> --edition <id>',
  '       pnpm content check --edition <id>',
  '       pnpm content have --edition <id> [--kind <kind>]',
  '       pnpm content counts --edition <id>',
  '       pnpm content import word|correction|idiom|synonym-row|tip <array.json | drafts folder> --edition <id> [--no-record]',
  '       pnpm content verify <files, ids or folder> | --changed <ref> --edition <id> [--book <text file>] [--cache <dir>]',
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
  if (['have', 'counts'].includes(process.argv[2] ?? '')) return listContent(process.argv.slice(2));
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      edition: { type: 'string' },
      'no-record': { type: 'boolean' },
      changed: { type: 'string' },
      book: { type: 'string' },
      cache: { type: 'string' },
    },
  });
  const [command, ...rest] = positionals;
  const [argument] = rest;
  const kind = command === 'new' && rest.length === 1 ? entryKind(argument) : undefined;
  const importKind = command === 'import' && rest.length === 2 ? entryKind(argument) : undefined;
  const known =
    (command === 'new' && kind !== undefined) ||
    importKind !== undefined ||
    ((command === 'edit' || command === 'retire') && rest.length === 1) ||
    (command === 'check' && rest.length === 0) ||
    (command === 'verify' && rest.length > 0 !== (values.changed !== undefined));
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
  const cwd = process.env['INIT_CWD'] ?? process.cwd();
  if (command === 'verify') {
    return verifyEntries({
      edition,
      targets:
        values.changed === undefined
          ? { kind: 'named', names: rest }
          : { kind: 'changed', ref: values.changed },
      bookFile: values.book === undefined ? undefined : resolve(cwd, values.book),
      client: new PoliteClient(
        fetchPage,
        systemClock,
        values.cache === undefined ? defaultCacheDir() : resolve(cwd, values.cache),
        POLITE_INTERVAL_MS,
        (line) => {
          terminal.problem(line);
        },
      ),
      cwd,
      print: (line) => {
        terminal.print(line);
      },
      problem: (line) => {
        terminal.problem(line);
      },
    });
  }
  if (kind !== undefined) return newEntry(kind, tool);
  if (importKind !== undefined)
    return importEntries(importKind, rest[1] ?? '', tool, { record: values['no-record'] !== true });
  if (command === 'edit') return editEntry(argument ?? '', tool);
  if (command === 'retire') return retireEntry(argument ?? '', tool);
  return checkEdition(tool);
}

process.exitCode = await main();
