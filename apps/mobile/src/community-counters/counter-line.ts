import type { CounterLine, CounterReads, KnowledgeMark } from '@slovo/core';
import { useEffect, useState } from 'react';

import { logError } from '../diagnostics/log';
import type { Opening } from '../opening';
import { useShell } from '../shell-value';

type Asked = Map<string, ((line: CounterLine | undefined) => void)[]>;

/** By the reads, the Entries whose lines were asked in this turn, read together in one request, and who waits for each. */
const askedOf = new WeakMap<Opening<CounterReads>, Asked>();

/**
 * The line of one Entry. The cards drawn together, those near the current
 * Feed card, ask in the same turn, so their Entries go out in one request.
 */
function lineOf(reads: Opening<CounterReads>, entryId: string): Promise<CounterLine | undefined> {
  return new Promise((resolve) => {
    let asked = askedOf.get(reads);
    if (asked === undefined) {
      asked = new Map();
      askedOf.set(reads, asked);
      queueMicrotask(() => {
        readAsked(reads);
      });
    }
    asked.set(entryId, [...(asked.get(entryId) ?? []), resolve]);
  });
}

function readAsked(reads: Opening<CounterReads>): void {
  const waiting = askedOf.get(reads);
  if (waiting === undefined) return;
  askedOf.delete(reads);
  void reads
    .opened()
    .then((reads) => reads.lines([...waiting.keys()]))
    .catch((error: unknown) => {
      logError('Could not read the Community Counters', error);
      return new Map<string, CounterLine>();
    })
    .then((lines) => {
      for (const [entryId, resolves] of waiting) {
        for (const resolve of resolves) resolve(lines.get(entryId));
      }
    });
}

/**
 * The Community Counters line of an Entry's card (ADR 0060), read again
 * whenever the reader's own mark or Favorite of it changes, so that change
 * shows at once; none until it is read, and none offline with nothing kept.
 * Not read at all while the line is not `shown`, as with the Knowledge switch off.
 * The card gives the reader's own mark and Favorite, which it reads already.
 */
export function useCounterLine(
  entryId: string,
  shown: boolean,
  { mark, inFavorites }: { mark: KnowledgeMark | undefined; inFavorites: boolean },
): CounterLine | undefined {
  // Kept with its Entry, so a card that turns to another Entry shows none of the last one's.
  const [read, setRead] = useState<{ entryId: string; line: CounterLine | undefined }>();
  const reads = useShell().counterReads;
  useEffect(() => {
    if (!shown) return;
    let current = true;
    void lineOf(reads, entryId).then((line) => {
      if (current) setRead({ entryId, line });
    });
    return () => {
      current = false;
    };
  }, [reads, entryId, shown, mark, inFavorites]);
  return read?.entryId === entryId ? read.line : undefined;
}
