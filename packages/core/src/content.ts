import type { Word } from '@slovo/contracts';

import type { ContentReadPort, Random } from './ports';

/** The Core's access to the Words of the Language Pack. */
export interface Content {
  wordById(id: string): Promise<Word | undefined>;
  firstWord(): Promise<Word | undefined>;
  randomWord(): Promise<Word | undefined>;
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
  };
}
