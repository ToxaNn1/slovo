/**
 * Our own OCR of a scan on this machine: Poppler's `pdftoppm` renders each
 * page at 300 dpi and Tesseract (`ukr+rus`) reads it, one process per core.
 * Every page's text is kept in `<cache>/hrinchenko/ocr/`, so an interrupted
 * run resumes where it stopped.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';

import type { ReadPages } from './hrinchenko';

const run = promisify(execFile);

/** Reads every page of a PDF, keeping each page's text in the cache. */
export function tesseractPages(cacheDir: string, log: (message: string) => void): ReadPages {
  return async (pdfFile) => {
    const dir = join(cacheDir, 'hrinchenko', 'ocr');
    mkdirSync(dir, { recursive: true });
    const { stdout } = await run('pdfinfo', [pdfFile]);
    const pages = Number(/^Pages:\s+(\d+)/m.exec(stdout)?.[1] ?? '0');
    const id = basename(pdfFile, '.pdf');
    const texts: string[] = Array.from({ length: pages }, () => '');
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < pages) {
        next += 1;
        const page = next;
        texts[page - 1] = await pageText(
          pdfFile,
          page,
          join(dir, `${id}-${String(page).padStart(4, '0')}`),
        );
        done += 1;
        if (done % 100 === 0) log(`  ${id}: ${String(done)} of ${String(pages)} pages`);
      }
    };
    await Promise.all(Array.from({ length: availableParallelism() }, worker));
    return texts;
  };
}

async function pageText(pdfFile: string, page: number, base: string): Promise<string> {
  const text = `${base}.txt`;
  if (existsSync(text)) return readFileSync(text, 'utf8');
  const image = `${base}-img`;
  await run('pdftoppm', [
    '-f',
    String(page),
    '-l',
    String(page),
    '-r',
    '300',
    '-gray',
    '-png',
    '-singlefile',
    pdfFile,
    image,
  ]);
  await run('tesseract', [`${image}.png`, `${base}.part`, '-l', 'ukr+rus', '--psm', '3'], {
    env: { ...process.env, OMP_THREAD_LIMIT: '1' },
  });
  rmSync(`${image}.png`);
  renameSync(`${base}.part.txt`, text);
  return readFileSync(text, 'utf8');
}
