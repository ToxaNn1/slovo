/**
 * What an Edition already has, as the API answers it:
 *
 *   pnpm content have --edition <id> [--kind <kind>]
 *   pnpm content counts --edition <id>
 *
 * `have` prints one line per live record of the content snapshot,
 * tab-separated: its id, its kind and its text. `counts` prints the content
 * report: the live records per kind, Category, type and rarity, with each
 * content target the content falls short of.
 */
import type { ApiClient } from '@slovo/contracts/api';

import { refusalLines, type RecordKind } from './api';
import type { Io } from './writes';

/** The live records of the snapshot, of one kind when one is named. */
export async function have(
  api: ApiClient,
  { editionId, kind: only }: { editionId: string; kind: RecordKind | undefined },
  io: Io,
): Promise<number> {
  let snapshot;
  try {
    snapshot = await api.content.snapshot({ editionId });
  } catch (error) {
    for (const line of refusalLines(editionId, error)) io.problem(line);
    return 1;
  }
  const texts: Record<RecordKind, { id: string; text: string; retired: boolean }[]> = {
    word: snapshot.words.map(({ id, lemma, retired }) => ({
      id,
      text: lemma,
      retired,
    })),
    correction: snapshot.corrections.map(({ id, nonStandardForm, retired }) => ({
      id,
      text: nonStandardForm,
      retired,
    })),
    idiom: snapshot.idioms.map(({ id, expression, retired }) => ({
      id,
      text: expression,
      retired,
    })),
    synonymRow: snapshot.synonymRows.map(({ id, dominant }) => ({
      id,
      text: dominant.text,
      retired: false,
    })),
    tip: snapshot.tips.map(({ id, title }) => ({ id, text: title, retired: false })),
    curatedCollection: snapshot.curatedCollections.map(({ id, name }) => ({
      id,
      text: name,
      retired: false,
    })),
  };
  for (const [kind, records] of Object.entries(texts)) {
    if (only !== undefined && kind !== only) continue;
    for (const { id, text, retired } of records)
      if (!retired) io.print([id, kind, text].join('\t'));
  }
  return 0;
}

/** The content report against the Edition's content targets. */
export async function counts(
  api: ApiClient,
  { editionId }: { editionId: string },
  io: Io,
): Promise<number> {
  let answer;
  try {
    answer = await api.admin.content.report({ editionId });
  } catch (error) {
    for (const line of refusalLines(editionId, error)) io.problem(line);
    return 1;
  }
  const { report, missed, contentVersion } = answer;
  const lines = [
    `Content version ${String(contentVersion)}`,
    '',
    `Words: ${String(report.words)} (retired ${String(report.retiredWords)})`,
    ...table([
      ['Category', 'words'],
      ...report.wordsPerCategory.map(({ categoryId, words }) => [categoryId, String(words)]),
    ]),
    ...table([
      ['Rarity', 'words'],
      ...report.rarity.map(({ rarity, words }) => [`r${String(rarity)}`, String(words)]),
    ]),
    ...table([
      ['Coverage', 'words'],
      ...Object.entries(report.coverage).map(([field, words]) => [field, String(words)]),
    ]),
    '',
    `Corrections: ${String(report.corrections)} (retired ${String(report.retiredCorrections)})`,
    ...table([
      ['Category', 'corrections'],
      ...report.correctionsPerCategory.map(({ categoryId, corrections }) => [
        categoryId,
        String(corrections),
      ]),
    ]),
    ...table([
      ['Type', 'corrections'],
      ...report.correctionsPerType.map(({ correctionType, corrections }) => [
        correctionType,
        String(corrections),
      ]),
    ]),
    '',
    `Idioms: ${String(report.idioms)} (retired ${String(report.retiredIdioms)})`,
    ...table([
      ['Type', 'idioms'],
      ...report.idiomsPerType.map(({ idiomType, idioms }) => [idiomType, String(idioms)]),
    ]),
    '',
    ...(missed.length === 0
      ? ['Every content target is met']
      : ['Missed targets:', ...missed.map(({ target, message }) => `  ${target}: ${message}`)]),
  ];
  for (const line of lines) io.print(line);
  return 0;
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
