import type { CounterLine } from '@slovo/core';
import { useEffect, useState } from 'react';

import { logError } from '../diagnostics/log';
import { useKnowledgeMark } from '../knowledge/marks';
import { useFavorite } from '../saved/favorites';
import { counterReadsOpening } from './device-counter-reads';

/** The Entries whose lines were asked in this turn, read together in one request, and who waits for each. */
let asked = new Map<string, ((line: CounterLine | undefined) => void)[]>();

/**
 * The line of one Entry. The cards drawn together, those near the current
 * Feed card, ask in the same turn, so their Entries go out in one request.
 */
function lineOf(entryId: string): Promise<CounterLine | undefined> {
  return new Promise((resolve) => {
    if (asked.size === 0) queueMicrotask(readAsked);
    asked.set(entryId, [...(asked.get(entryId) ?? []), resolve]);
  });
}

function readAsked(): void {
  const waiting = asked;
  asked = new Map();
  void counterReadsOpening
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
 */
export function useCounterLine(entryId: string): CounterLine | undefined {
  const [line, setLine] = useState<CounterLine | undefined>();
  const { mark } = useKnowledgeMark(entryId);
  const { inFavorites } = useFavorite(entryId);
  useEffect(() => {
    let current = true;
    void lineOf(entryId).then((read) => {
      if (current) setLine(read);
    });
    return () => {
      current = false;
    };
  }, [entryId, mark, inFavorites]);
  return line;
}
