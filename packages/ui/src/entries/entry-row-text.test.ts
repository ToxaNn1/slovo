import type { EditionStrings } from '@slovo/contracts';
import type { EntryRowModel } from '@slovo/core';
import { entryLabel, entryLabelBeside, entryRowSubtitle } from '@slovo/ui/entry-row-text';
import { describe, expect, it } from 'vitest';

const kinds: EditionStrings['history']['kinds'] = {
  word: 'word',
  correction: 'correction',
  wordOfTheDay: 'word of the day',
  idiom: 'idiom',
  placeName: 'place name',
  proverb: 'proverb',
  synonymRow: 'synonyms',
  tip: 'tip',
};

const correctionCard = { insteadOf: 'instead of «{form}»' };

const word: EntryRowModel = {
  kind: 'word',
  entryId: 'w_a',
  title: 'cándid',
  secondLine: 'Open and honest.',
  labelKey: 'word',
  spoken: 'candid, Open and honest.',
  partOfSpeech: 'adjective',
  registers: [],
};

const correction: EntryRowModel = {
  kind: 'correction',
  entryId: 'c_a',
  title: 'in the meantime',
  secondLine: 'in the meantimes',
  labelKey: 'correction',
  spoken: 'in the meantime, in the meantimes',
  correctionType: 'calque',
};

const idiom = (labelKey: 'idiom' | 'placeName'): EntryRowModel => ({
  kind: 'idiom',
  entryId: 'i_a',
  title: 'spill the beans',
  secondLine: 'To give away a secret.',
  labelKey,
  spoken: 'spill the beans, To give away a secret.',
});

const synonymRow: EntryRowModel = {
  kind: 'synonymRow',
  entryId: 'r_a',
  title: 'wálk',
  secondLine: 'To move on foot.',
  labelKey: 'synonymRow',
  spoken: 'walk, To move on foot.',
};

const tip: EntryRowModel = {
  kind: 'tip',
  entryId: 't_a',
  title: 'What time is it?',
  secondLine: 'What time is it now?',
  labelKey: 'tip',
  spoken: 'What time is it?, What time is it now?',
};

describe('the words of an Entry row', () => {
  it('names the kind of each row, a place name by its Idiom Type', () => {
    expect(entryLabel(kinds, word)).toBe('word');
    expect(entryLabel(kinds, correction)).toBe('correction');
    expect(entryLabel(kinds, idiom('idiom'))).toBe('idiom');
    expect(entryLabel(kinds, idiom('placeName'))).toBe('place name');
    expect(entryLabel(kinds, synonymRow)).toBe('synonyms');
    expect(entryLabel(kinds, tip)).toBe('tip');
  });

  it('puts the Definition under a Word or an Idiom, and the replaced form under a Correction', () => {
    expect(entryRowSubtitle(correctionCard, word)).toBe('Open and honest.');
    expect(entryRowSubtitle(correctionCard, idiom('placeName'))).toBe('To give away a secret.');
    expect(entryRowSubtitle(correctionCard, correction)).toBe('instead of «in the meantimes»');
    expect(entryRowSubtitle(correctionCard, synonymRow)).toBe('To move on foot.');
    expect(entryRowSubtitle(correctionCard, tip)).toBe('What time is it now?');
  });

  it('puts the label of every kind beside a time, as Favorites and Collections say it', () => {
    const strings = { kinds, kindBeside: '{kind} · {time}' };

    expect(entryLabelBeside(strings, word, 'today')).toBe('word · today');
    expect(entryLabelBeside(strings, correction, 'today')).toBe('correction · today');
    expect(entryLabelBeside(strings, idiom('idiom'), 'today')).toBe('idiom · today');
    expect(entryLabelBeside(strings, idiom('placeName'), 'today')).toBe('place name · today');
    expect(entryLabelBeside(strings, synonymRow, 'today')).toBe('synonyms · today');
    expect(entryLabelBeside(strings, tip, 'today')).toBe('tip · today');
  });
});
