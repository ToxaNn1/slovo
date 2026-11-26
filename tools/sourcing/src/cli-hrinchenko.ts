/**
 * Builds Грінченко's index in the sourcing cache, once (ADR 0207):
 *
 *   pnpm source:hrinchenko [--cache <dir>]
 *
 * Downloads the pinned public-domain scans from archive.org, checks their
 * SHA-256, reads them by our own OCR (Poppler and Tesseract with `ukr` and
 * `rus` must be installed) and writes `<headword>\t<gloss>\t<sigla>` lines.
 * `source:lemmas --from hrinchenko` and `source:words` read it from there.
 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { loadHrinchenko } from './hrinchenko';
import { tesseractPages } from './hrinchenko-ocr';
import { defaultCacheDir, fetchBytes } from './node-ports';

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { cache: { type: 'string' } } });
  const cwd = process.env['INIT_CWD'] ?? process.cwd();
  const cacheDir = values.cache === undefined ? defaultCacheDir() : resolve(cwd, values.cache);
  const log = (message: string) => {
    console.error(message);
  };
  const index = await loadHrinchenko({
    cacheDir,
    download: fetchBytes,
    readPages: tesseractPages(cacheDir, log),
    log,
  });
  log(`Грінченко: ${String(index.size)} headwords in ${cacheDir}`);
  return 0;
}

process.exitCode = await main();
