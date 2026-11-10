import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import type { EditionConfig, EditionTokens } from '@slovo/contracts';
import { STRESS_MARK } from '@slovo/core';

import type { BuildError } from './build-error';
import { FONTS_DIR } from './edition-folder';

/**
 * Why the Edition's fonts can't set its text (ADR 0035, 0070): the Word of
 * the Day font named in the Edition config, and every file of the word and
 * UI families its tokens name. A font must be among the Edition's fonts, be
 * a font, and have a glyph for every letter of the alphabet, in either case,
 * and for the punctuation a Lemma may hold. The fonts that set a Lemma, the
 * Word of the Day font and the word family, also need the Stress mark of an
 * Edition that marks Stress. A family is found by its files' names, which
 * are their PostScript names: `Unbounded-Black.ttf` is of the family
 * `Unbounded`. Each refusal names every missing character.
 */
export function editionFontErrors(
  config: EditionConfig,
  tokens: EditionTokens | undefined,
  fonts: readonly string[],
): BuildError[] {
  const errors: BuildError[] = [];
  const name = config.wordOfTheDayFont;
  const wordOfTheDayFont = fonts.find((font) => basename(font) === name);
  const refuseWordOfTheDayFont = (message: string) =>
    errors.push({ file: 'edition.json', field: 'wordOfTheDayFont', message });
  if (wordOfTheDayFont === undefined)
    refuseWordOfTheDayFont(`No font file ${name} in ${FONTS_DIR}/`);
  else glyphErrors(wordOfTheDayFont, config, true).forEach(refuseWordOfTheDayFont);

  for (const role of ['word', 'ui'] as const) {
    const family = tokens?.fontFamilies?.[role];
    if (family === undefined) continue;
    const refuse = (message: string) =>
      errors.push({ file: 'tokens.json', field: `fontFamilies.${role}`, message });
    const prefix = `${family.replaceAll(' ', '')}-`;
    const files = fonts.filter((font) => basename(font).startsWith(prefix));
    if (files.length === 0) refuse(`No font file of the family ${family} in ${FONTS_DIR}/`);
    for (const file of files) glyphErrors(file, config, role === 'word').forEach(refuse);
  }
  return errors;
}

/** Why one font file can't set the Edition's text, as at most one message. */
function glyphErrors(
  path: string,
  { locale, languageTraits }: EditionConfig,
  setsLemmas: boolean,
): string[] {
  const shown = `${FONTS_DIR}/${basename(path)}`;
  const hasGlyph = characterMap(readFileSync(path));
  if (hasGlyph === undefined) return [`${shown} is not a TrueType or OpenType font`];
  const characters = [
    ...languageTraits.alphabet.flatMap((letter) => [letter, letter.toLocaleUpperCase(locale)]),
    ...(languageTraits.lemmaPunctuation ?? []),
  ];
  const missing = [...new Set(characters)]
    .filter((shown) => Array.from(shown).some((character) => !hasGlyph(character)))
    .concat(
      setsLemmas && languageTraits.stress.marked && !hasGlyph(STRESS_MARK)
        ? ['the Stress mark (U+0301)']
        : [],
    );
  return missing.length === 0 ? [] : [`${shown} has no glyph for ${missing.join(', ')}`];
}

/**
 * Whether a TrueType or OpenType font maps a character to a glyph, read
 * from the Unicode subtables of its character map (`cmap`, formats 4 and
 * 12). Undefined when the bytes hold no character map.
 */
function characterMap(font: Buffer): ((character: string) => boolean) | undefined {
  try {
    const tableCount = font.readUInt16BE(4);
    let cmap: number | undefined;
    for (let table = 0; table < tableCount; table++) {
      const record = 12 + 16 * table;
      if (font.toString('latin1', record, record + 4) === 'cmap')
        cmap = font.readUInt32BE(record + 8);
    }
    if (cmap === undefined) return undefined;
    const lookups: ((code: number) => number)[] = [];
    for (let index = 0; index < font.readUInt16BE(cmap + 2); index++) {
      const record = cmap + 4 + 8 * index;
      const platform = font.readUInt16BE(record);
      const encoding = font.readUInt16BE(record + 2);
      const isUnicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
      const subtable = cmap + font.readUInt32BE(record + 4);
      const format = font.readUInt16BE(subtable);
      if (isUnicode && format === 4) lookups.push(format4(font, subtable));
      if (isUnicode && format === 12) lookups.push(format12(font, subtable));
    }
    if (lookups.length === 0) return undefined;
    return (character) => {
      const code = character.codePointAt(0) ?? 0;
      return lookups.some((glyphOf) => glyphOf(code) !== 0);
    };
  } catch (error) {
    // A file too short for the tables it names is not a font.
    if (error instanceof RangeError) return undefined;
    throw error;
  }
}

/** The glyph of a character in a format 4 subtable: segments of the Basic Multilingual Plane. */
function format4(font: Buffer, subtable: number): (code: number) => number {
  const segments = font.readUInt16BE(subtable + 6) / 2;
  const ends = subtable + 14;
  const starts = ends + 2 * segments + 2;
  const deltas = starts + 2 * segments;
  const rangeOffsets = deltas + 2 * segments;
  return (code) => {
    for (let segment = 0; segment < segments; segment++) {
      if (code > font.readUInt16BE(ends + 2 * segment)) continue;
      const start = font.readUInt16BE(starts + 2 * segment);
      if (code < start) return 0;
      const delta = font.readUInt16BE(deltas + 2 * segment);
      const rangeOffset = rangeOffsets + 2 * segment;
      const offset = font.readUInt16BE(rangeOffset);
      if (offset === 0) return (code + delta) & 0xffff;
      const glyph = font.readUInt16BE(rangeOffset + offset + 2 * (code - start));
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };
}

/** The glyph of a character in a format 12 subtable: groups of any Unicode characters. */
function format12(font: Buffer, subtable: number): (code: number) => number {
  const groups = font.readUInt32BE(subtable + 12);
  return (code) => {
    for (let group = 0; group < groups; group++) {
      const record = subtable + 16 + 12 * group;
      const start = font.readUInt32BE(record);
      if (code >= start && code <= font.readUInt32BE(record + 4)) {
        return font.readUInt32BE(record + 8) + (code - start);
      }
    }
    return 0;
  };
}
