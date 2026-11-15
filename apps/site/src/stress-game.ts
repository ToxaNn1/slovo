/** One round of the landing's Наголос game: the word and the index of its stressed letter. */
export type StressRound = Readonly<{ word: string; stress: number }>;

/** The design's rounds, in order; чорносли́в with its dictionary stress (the design marked чорно́слив). */
export const stressGame: readonly StressRound[] = [
  { word: 'кілометр', stress: 5 },
  { word: 'чорнослив', stress: 7 },
  { word: 'завдання', stress: 4 },
  { word: 'випадок', stress: 1 },
  { word: 'олень', stress: 0 },
];

const VOWELS = 'аеєиіїоуюя';

/** Whether the letter is a Ukrainian vowel, the only letters a reader can pick. */
export function isVowel(letter: string): boolean {
  return VOWELS.includes(letter);
}

/** The word with the stress mark after the letter at `index`. */
export function stressed(word: string, index: number): string {
  return `${word.slice(0, index + 1)}́${word.slice(index + 1)}`;
}

/** What the game says after the reader picks the letter at `pick`. */
export function verdict(round: StressRound, pick: number): string {
  const answer = stressed(round.word, round.stress);
  return pick === round.stress ? `Так! ${answer}` : `Ні — правильно ${answer}`;
}
