import type { CrossingCrossword } from '@slovo/core';

/**
 * Lemmas of the Edition's alphabet, three to five letters long, enough to
 * fill the crossing Daily Crossword's grid (ADR 0087) in a screen test.
 */
export const CROSSING_LEMMAS = (
  'кіт дім сік лис рак кит вуж сом бик лев мак сад ліс сон рів тин бук дуб віз гай ' +
  'сир мед лук рис хор міх ніс рот зуб лоб бір пар дах сніп ' +
  'вовк сова лось кінь осот коза зима море поле річ гора нора хата вода руда липа ' +
  'вата рама мова каша нива рука нога сало лоза пила роса сіно тато мама ' +
  'весна зоря ріпа кора сосна берег село місто ранок вечір літо осінь ' +
  'качка гуска ворон птаха дошка карта нитка палка колос тіло ' +
  'зерно сокіл орел шлях ліжко вікно двері стіна'
)
  .split(' ')
  .filter((lemma) => lemma !== '');

/**
 * Solves the Word of this index of the crossing Daily Crossword through the
 * Core: selects it, traces its letters on its wheel and releases.
 */
export async function solveCrossingWord(crossword: CrossingCrossword, index: number) {
  const target = crossword.puzzle.words[index];
  if (target === undefined) throw new Error(`No Word ${String(index)}`);
  const select = { type: 'select', place: target.start } as const;
  await crossword.play(select);
  if (crossword.state.current !== index) await crossword.play(select);
  const used = new Set<number>();
  for (const letter of target.letters) {
    const tile = target.wheel.findIndex((candidate, i) => candidate === letter && !used.has(i));
    used.add(tile);
    await crossword.play({ type: 'extend', tile });
  }
  await crossword.play({ type: 'release' });
}
