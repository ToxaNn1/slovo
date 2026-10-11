import type { Correction, Word } from '@slovo/contracts';

import type { ContentReadPort, Random } from './ports';

/** The Core's access to the Entries of the Language Pack. */
export interface Content {
  wordById(id: string): Promise<Word | undefined>;
  firstWord(): Promise<Word | undefined>;
  randomWord(): Promise<Word | undefined>;
  correctionById(id: string): Promise<Correction | undefined>;
  /** The Corrections a Word is the standard form for, in the order the Word links them. */
  linkedCorrections(wordId: string): Promise<Correction[]>;
  /** The Words, not retired, that are the standard form for a Correction. */
  linkedWords(correctionId: string): Promise<Word[]>;
}

export function createContent({
  port,
  random,
}: {
  port: ContentReadPort;
  random: Random;
}): Content {
  async function wordAt(pick: (count: number) => number): Promise<Word | undefined> {
    const ids = await port.listWordIds();
    const id = ids[pick(ids.length)];
    return id === undefined ? undefined : port.getWord(id);
  }

  return {
    wordById: (id) => port.getWord(id),
    firstWord: () => wordAt(() => 0),
    randomWord: () => wordAt((count) => Math.floor(random.next() * count)),
    correctionById: (id) => port.getCorrection(id),
    async linkedCorrections(wordId) {
      const word = await port.getWord(wordId);
      return present(
        await Promise.all((word?.correctionIds ?? []).map((id) => port.getCorrection(id))),
      );
    },
    async linkedWords(correctionId) {
      const ids = await port.listLinkedWordIds(correctionId);
      return present(await Promise.all(ids.map((id) => port.getWord(id))));
    },
  };
}

function present<T>(items: readonly (T | undefined)[]): T[] {
  return items.filter((item) => item !== undefined);
}
