import type { Source } from '@slovo/contracts';

/** How a card's «Джерело:» line names each source, in their order: its short name, or its title without one. */
export const sourceNamesOf = (sources: readonly Source[]): readonly string[] =>
  sources.map((source) => source.shortName ?? source.title);
