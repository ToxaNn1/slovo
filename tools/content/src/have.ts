/**
 * What an Edition already has, printed to stdout:
 *
 *   pnpm content have --edition <id> [--kind word|correction|idiom|synonym-row|tip]
 *   pnpm content counts --edition <id>
 *
 * `have` prints one line per Entry, tab-separated: its kind, its Category or
 * type, its text, and `retired` for a Retired Entry. `counts` prints the
 * Words per Category and rarity and the Corrections per Category, with
 * totals; a cell or row under a content target shows its gap.
 */
import { parseArgs } from 'node:util';

import { rarityFloor, wordFloor, type ContentTargets } from '@slovo/language-pack';
import {
  EDITIONS_DIR,
  EditionFolderError,
  openEdition,
  type EditionFolder,
} from '@slovo/language-pack/edition';

import { entryKind, KIND_NAMES, type EntryKind } from './content';

const USAGE = [
  'Usage: pnpm content have --edition <id> [--kind word|correction|idiom|synonym-row|tip]',
  '       pnpm content counts --edition <id>',
].join('\n');

const RARITIES = [1, 2, 3, 4, 5] as const;

/** Runs `have` or `counts` with the arguments after `pnpm content`; returns the exit code. */
export function listContent(args: readonly string[]): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...args],
      allowPositionals: true,
      options: { edition: { type: 'string' }, kind: { type: 'string' } },
    });
  } catch {
    console.error(USAGE);
    return 2;
  }
  const { positionals, values } = parsed;
  const [command, ...rest] = positionals;
  const kind = values.kind === undefined ? undefined : entryKind(values.kind);
  const known =
    rest.length === 0 &&
    ((command === 'have' && (values.kind === undefined || kind !== undefined)) ||
      (command === 'counts' && values.kind === undefined));
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
  const printed = command === 'have' ? have(edition, kind) : counts(edition);
  for (const line of printed) console.log(line);
  return 0;
}

function have(edition: EditionFolder, only: EntryKind | undefined): string[] {
  return edition.entryTexts().flatMap(({ kind: entryKindOf, group, text, forms, retired }) => {
    const kind = KIND_NAMES[entryKindOf];
    if (only !== undefined && kind !== only) return [];
    const shown = forms.length === 0 ? text : `${text} -> ${forms.join(', ')}`;
    return [[kind, group ?? '-', shown, ...(retired ? ['retired'] : [])].join('\t')];
  });
}

/** The tables of Words and Corrections; Retired Entries are left out, as the content targets count. */
function counts(edition: EditionFolder): string[] {
  const { categories, correctionCategories } = edition.config;
  const targets: ContentTargets = edition.readIfPresent('targets') ?? {};
  const { words, corrections } = edition.entries();
  const liveWords = words.map(({ entry }) => entry).filter((word) => !word.retired);
  const liveCorrections = corrections
    .map(({ entry }) => entry)
    .filter((correction) => !correction.retired);
  const perRarity = rarityFloor(targets);

  const wordRows = categories.map(({ id }) => {
    const inCategory = liveWords.filter((word) => word.categoryId === id);
    const floor = wordFloor(targets, id)?.min;
    return [
      id,
      ...RARITIES.map((rarity) => cell(inCategory.filter((word) => word.rarity === rarity).length)),
      cell(inCategory.length, floor),
    ];
  });
  const wordTotals = [
    'total',
    ...RARITIES.map((rarity) =>
      cell(liveWords.filter((word) => word.rarity === rarity).length, perRarity),
    ),
    cell(liveWords.length, targets.minWords),
  ];
  const correctionRows = correctionCategories.map(({ id }) => [
    id,
    cell(
      liveCorrections.filter((correction) => correction.categoryId === id).length,
      targets.minCorrectionsPerCategory,
    ),
  ]);
  const correctionTotals = ['total', cell(liveCorrections.length, targets.minCorrections)];

  return [
    ...table([
      ['Words', ...RARITIES.map((rarity) => `r${String(rarity)}`), 'total'],
      ...wordRows,
      wordTotals,
    ]),
    '',
    ...table([['Corrections', 'total'], ...correctionRows, correctionTotals]),
  ];
}

/** A count, with its gap when it is under the target's floor. */
function cell(count: number, floor?: number): string {
  return floor === undefined || count >= floor
    ? String(count)
    : `${String(count)} (-${String(floor - count)})`;
}

/** Rows as columns padded to their widest cell, two spaces apart. */
function table(rows: readonly (readonly string[])[]): string[] {
  const widths = rows.reduce<number[]>(
    (widest, row) => row.map((value, column) => Math.max(value.length, widest[column] ?? 0)),
    [],
  );
  return rows.map((row) =>
    row
      .map((value, column) => value.padEnd(widths[column] ?? 0))
      .join('  ')
      .trimEnd(),
  );
}
