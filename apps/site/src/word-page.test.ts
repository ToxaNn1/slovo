import { describe, expect, it } from 'vitest';

import {
  grammarLine,
  lemmaParts,
  metaDescription,
  rarityBars,
  similarWords,
  synonymLinks,
} from './word-page';

const labels = {
  partsOfSpeech: {
    noun: { short: 'ім.', full: 'іменник' },
    verb: { short: 'дієсл.', full: 'дієслово' },
    adjective: { short: 'прикм.', full: 'прикметник' },
    adverb: { short: 'присл.', full: 'прислівник' },
    pronoun: { short: 'займ.', full: 'займенник' },
    numeral: { short: 'числ.', full: 'числівник' },
    preposition: { short: 'прийм.', full: 'прийменник' },
    conjunction: { short: 'спол.', full: 'сполучник' },
    particle: { short: 'част.', full: 'частка' },
    interjection: { short: 'виг.', full: 'вигук' },
  },
  genders: {
    masculine: { short: 'ч. р.', full: 'чоловічий рід' },
    feminine: { short: 'ж. р.', full: 'жіночий рід' },
    neuter: { short: 'с. р.', full: 'середній рід' },
    common: { short: 'спільн. р.', full: 'спільний рід' },
    'plural-only': { short: 'мн.', full: 'лише множина' },
  },
  partOfSpeechWithGender: '{partOfSpeech}, {gender}',
};

describe('a Word page', () => {
  it('splits the Lemma so each stressed vowel carries its mark on its own', () => {
    expect(lemmaParts({ lemma: 'кракелюр', stress: [6] })).toEqual([
      { text: 'кракел', stressed: false },
      { text: 'ю́', stressed: true },
      { text: 'р', stressed: false },
    ]);
    expect(lemmaParts({ lemma: 'ока', stress: [0, 2] })).toEqual([
      { text: 'о́', stressed: true },
      { text: 'к', stressed: false },
      { text: 'а́', stressed: true },
    ]);
  });

  it('names the part of speech, with the gender of a noun', () => {
    expect(grammarLine({ partOfSpeech: 'noun', gender: 'masculine' }, labels)).toBe(
      'іменник, чоловічий рід',
    );
    expect(grammarLine({ partOfSpeech: 'verb', gender: undefined }, labels)).toBe('дієслово');
  });

  it('lights as many rarity bars as the rarity', () => {
    expect(rarityBars(4)).toEqual([true, true, true, true, false]);
  });

  it('shows the Words of its Category after it in id order, wrapping round', () => {
    const words = ['w_1', 'w_2', 'w_3', 'w_4', 'w_5', 'w_6', 'w_7', 'w_8'].map((id, i) => ({
      id,
      categoryId: i === 2 ? 'other' : 'arts',
    }));
    const similar = (id: string) =>
      similarWords({ id, categoryId: id === 'w_3' ? 'other' : 'arts' }, words, 4);
    expect(similar('w_5').map((w) => w.id)).toEqual(['w_6', 'w_7', 'w_8', 'w_1']);
    expect(similar('w_3')).toEqual([]);
  });

  it('links a Synonym when a live Word has it as its Lemma', () => {
    const words = [
      { id: 'w_2', lemma: 'плошка' },
      { id: 'w_1', lemma: 'каганець' },
    ];
    const slugs = new Map([
      ['w_1', 'kahanets'],
      ['w_2', 'ploshka'],
    ]);
    expect(synonymLinks(['Кагане́ць', 'мигунець', 'пло́шка'], words, slugs)).toEqual([
      { text: 'Кагане́ць', slug: 'kahanets' },
      { text: 'мигунець', slug: undefined },
      { text: 'пло́шка', slug: 'ploshka' },
    ]);
  });

  it('describes the page by its definition, cut at a word when it is long', () => {
    expect(metaDescription({ lemma: 'обруч', primaryDefinition: 'Зігнута кільцем смуга.' })).toBe(
      'обруч — Зігнута кільцем смуга.',
    );
    const long = metaDescription({ lemma: 'слово', primaryDefinition: 'дуже довге, '.repeat(30) });
    expect(long.length).toBeLessThanOrEqual(155);
    expect(long).toMatch(/довге…$/);
  });
});
