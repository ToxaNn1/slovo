/**
 * Picks Word candidates from a dictionary headword list, with no language
 * model, and writes them as a Lemma list for `source:words`:
 *
 *   pnpm source:lemmas --edition <id> [--snapshot <file>] [--count <n>] [--letters <letters>]
 *                      [--pos noun:55,adj:20,verb:20,adv:5] [--rarity 2:1,3:1,4:1,5:1]
 *                      [--exclude <list file>]… [--seed <n>] [--out <file>] [--cache <dir>]
 *
 * The headword list (LanguageTool's morfologik-ukrainian-lt, from dict_uk) and
 * the `wordfreq` list are downloaded once into the sourcing cache. The
 * Edition's Words, Retired ones too, come from its content snapshot:
 * `--snapshot`, else the backend at `$SLOVO_API_URL`. The list goes to
 * `--out`, else to standard output; the pool and the seed go to standard error.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  EDITIONS_DIR,
  EditionFolderError,
  openEditionWithSnapshot,
} from '@slovo/language-pack/edition';

import {
  CANDIDATE_POS,
  CANDIDATE_RARITIES,
  randomFromSeed,
  sourceLemmas,
} from './lemma-candidates';
import { loadHeadwords, loadWordfreq } from './lemma-sources';
import { defaultCacheDir, fetchBytes } from './node-ports';
import { contentSnapshot } from './snapshot';
import { SOURCE_LANGUAGE } from './text';
import { zipfOf } from './wordfreq';

const USAGE =
  'Usage: pnpm source:lemmas --edition <id> [--snapshot <file>] [--count <n>] [--letters <letters>] [--pos noun:55,adj:20,verb:20,adv:5] [--rarity 2:1,3:1,4:1,5:1] [--exclude <list file>]... [--seed <n>] [--out <file>] [--cache <dir>]';

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      edition: { type: 'string' },
      snapshot: { type: 'string' },
      count: { type: 'string' },
      letters: { type: 'string' },
      pos: { type: 'string' },
      rarity: { type: 'string' },
      exclude: { type: 'string', multiple: true },
      seed: { type: 'string' },
      out: { type: 'string' },
      cache: { type: 'string' },
    },
  });
  const seed =
    values.seed === undefined ? Math.floor(Math.random() * 2 ** 31) : Number(values.seed);
  if (positionals.length > 0 || values.edition === undefined || !Number.isInteger(seed)) {
    console.error(USAGE);
    return 2;
  }
  const cwd = process.env['INIT_CWD'] ?? process.cwd();
  const snapshot = await contentSnapshot({
    editionId: values.edition,
    file: values.snapshot === undefined ? undefined : resolve(cwd, values.snapshot),
    apiUrl: process.env['SLOVO_API_URL'],
  });
  if (!snapshot.ok) {
    console.error(snapshot.error);
    return 2;
  }
  let alphabet: readonly string[];
  try {
    const { config } = openEditionWithSnapshot(EDITIONS_DIR, values.edition, snapshot.snapshot);
    if (new Intl.Locale(config.locale).language !== SOURCE_LANGUAGE) {
      console.error(`The headword list is Ukrainian, but the Edition is in ${config.locale}`);
      return 2;
    }
    alphabet = config.languageTraits.alphabet;
  } catch (error) {
    if (!(error instanceof EditionFolderError)) throw error;
    console.error(error.message);
    return 2;
  }

  const log = (message: string) => {
    console.error(message);
  };
  const sources = {
    cacheDir: values.cache === undefined ? defaultCacheDir() : resolve(cwd, values.cache),
    download: fetchBytes,
    log,
  };
  const [headwords, frequencies] = [await loadHeadwords(sources), await loadWordfreq(sources)];
  const result = sourceLemmas({
    headwords,
    zipf: (lemma) => zipfOf(frequencies, lemma),
    alphabet,
    existingLemmas: snapshot.snapshot.words.map(({ lemma }) => lemma),
    excludeLists: (values.exclude ?? []).map((file) => readFileSync(resolve(cwd, file), 'utf8')),
    options: {
      count: values.count,
      letters: values.letters,
      pos: values.pos,
      rarity: values.rarity,
    },
    random: randomFromSeed(seed),
  });
  if (!result.ok) {
    for (const error of result.errors) console.error(error);
    return 1;
  }

  if (values.out === undefined) process.stdout.write(result.list);
  else writeFileSync(resolve(cwd, values.out), result.list);
  log(`Candidates to pick from (rarity: ${CANDIDATE_POS.join(' / ')}):`);
  for (const rarity of CANDIDATE_RARITIES) {
    const row = result.pool[rarity];
    const total = CANDIDATE_POS.reduce((sum, pos) => sum + row[pos], 0);
    log(
      `  ${String(rarity)}: ${CANDIDATE_POS.map((pos) => String(row[pos])).join(' / ')} (${String(total)})`,
    );
  }
  const written = result.list
    .split('\n')
    .filter((line) => line !== '' && !line.startsWith('#')).length;
  log(
    `Wrote ${String(written)} line(s)${result.shortfall > 0 ? `, ${String(result.shortfall)} short of the count` : ''}; --seed ${String(seed)} repeats this pick.`,
  );
  return 0;
}

process.exitCode = await main();
