import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import plist from '@expo/plist';
import { WidgetSnapshotSchema } from '@slovo/contracts';
import { loadDecor } from '@slovo/core';
import { FONTS_DIR } from '@slovo/language-pack/edition';
import { coreTokens, designTokens } from '@slovo/ui/tokens';
import { describe, expect, it } from 'vitest';

import { strings, ukrainianFolder } from '../src/test-support';

import { widgetExtensionFiles, writeWidgetExtension, type WidgetEdition } from './widget-extension';

/** Two of the Edition's fonts, in the word and UI families the widget draws with. */
const fontFiles = ['Onest-Bold.ttf', 'Unbounded-SemiBold.ttf'].map((font) =>
  join(ukrainianFolder.dir, FONTS_DIR, font),
);

/** The UA Edition as the prebuild hands it to the widget extension. */
const ukrainian: WidgetEdition = {
  config: ukrainianFolder.config,
  scheme: 'slovo-uk',
  appGroup: 'group.app.slovo.uk',
  strings: strings.widget,
  tokens: designTokens(ukrainianFolder.read('tokens')),
  mascot: loadDecor(ukrainianFolder.read('decor')).mascot,
  fontFiles,
  exampleSnapshot: ukrainianFolder.path('widgetSnapshotExample'),
};

const text = (files: Map<string, string | Buffer>, path: string) => {
  const contents = files.get(path);
  if (contents === undefined)
    throw new Error(`No file ${path} among ${[...files.keys()].join(', ')}`);
  return contents.toString();
};

const json = (files: Map<string, string | Buffer>, path: string): unknown =>
  JSON.parse(text(files, path));

const dark = [{ appearance: 'luminosity', value: 'dark' }];

describe("the widget extension's Edition files", () => {
  const files = widgetExtensionFiles(ukrainian);

  const fixed = (name: string) =>
    json(files, `Generated/Assets.xcassets/${name}.colorset/Contents.json`);
  const oneColor = ([red, green, blue, alpha = '1.000']: string[]) => ({
    colors: [
      {
        idiom: 'universal',
        color: { 'color-space': 'srgb', components: { red, green, blue, alpha } },
      },
    ],
    info: { author: 'xcode', version: 1 },
  });

  const red = ['1.000', '0.231', '0.184'];
  const cream = ['1.000', '0.957', '0.902'];
  const nearBlack = ['0.078', '0.047', '0.039'];

  it('draws Авто as the small design in both appearances: the red background, the ink on it and the giant letter in cream', () => {
    expect(fixed('backgroundSmall')).toEqual(oneColor(red));
    expect(fixed('inkSmall')).toEqual(oneColor(nearBlack));
    expect(fixed('inkSecondarySmall')).toEqual(oneColor(nearBlack));
    expect(fixed('accentSmall')).toEqual(oneColor(nearBlack));
    expect(fixed('markSmall')).toEqual(oneColor(cream));
  });

  it("draws Авто as the medium design in the phone's appearance: the background, the ink, the second line at 85% and the red overline and wedge", () => {
    const twoColors = (light: string[], darkRgb: string[]) => ({
      colors: [oneColor(light).colors[0], { ...oneColor(darkRgb).colors[0], appearances: dark }],
      info: { author: 'xcode', version: 1 },
    });

    expect(fixed('backgroundMedium')).toEqual(twoColors(cream, nearBlack));
    expect(fixed('inkMedium')).toEqual(twoColors(nearBlack, cream));
    expect(fixed('inkSecondaryMedium')).toEqual(
      twoColors([...nearBlack, '0.850'], [...cream, '0.850']),
    );
    expect(fixed('accentMedium')).toEqual(oneColor(red));
    expect(fixed('markMedium')).toEqual(oneColor(red));
  });

  it.each([
    ['Light', cream, nearBlack],
    ['Dark', nearBlack, cream],
  ])(
    'writes the %s background with one appearance of the colour tokens, the accent as the mark',
    (name, background, ink) => {
      expect(fixed(`background${name}`)).toEqual(oneColor(background));
      expect(fixed(`ink${name}`)).toEqual(oneColor(ink));
      expect(fixed(`inkSecondary${name}`)).toEqual(oneColor(ink));
      expect(fixed(`accent${name}`)).toEqual(oneColor(red));
      expect(fixed(`mark${name}`)).toEqual(oneColor(red));
    },
  );

  it.each([
    ['Parchment', ['0.953', '0.914', '0.824'], ['0.231', '0.165', '0.102']],
    ['Blue', ['0.122', '0.227', '0.373'], ['0.953', '0.914', '0.824']],
  ])(
    'writes the %s background and its ink, with the secondary ink as the ink at 72%%, the accent as the ink and the mark as the ink at 16%%, since the widget palette has one text colour',
    (name, background, ink) => {
      expect(fixed(`background${name}`)).toEqual(oneColor(background));
      expect(fixed(`ink${name}`)).toEqual(oneColor(ink));
      expect(fixed(`inkSecondary${name}`)).toEqual(oneColor([...ink, '0.720']));
      expect(fixed(`accent${name}`)).toEqual(oneColor(ink));
      expect(fixed(`mark${name}`)).toEqual(oneColor([...ink, '0.160']));
    },
  );

  it("takes the Parchment and Blue backgrounds from the Edition's widget palette", () => {
    const palette = widgetExtensionFiles({
      ...ukrainian,
      config: {
        ...ukrainian.config,
        widgetPalette: {
          parchment: { background: '#FFFFFF', text: '#000000' },
          blue: { background: '#000000', text: '#FFFFFF' },
        },
      },
    });
    const color = (name: string) =>
      json(palette, `Generated/Assets.xcassets/${name}.colorset/Contents.json`);

    expect(color('backgroundParchment')).toEqual(oneColor(['1.000', '1.000', '1.000']));
    expect(color('inkParchment')).toEqual(oneColor(['0.000', '0.000', '0.000']));
    expect(color('backgroundBlue')).toEqual(oneColor(['0.000', '0.000', '0.000']));
    expect(color('inkBlue')).toEqual(oneColor(['1.000', '1.000', '1.000']));
  });

  it('writes a colour drawn over others with its opacity', () => {
    const translucent = widgetExtensionFiles({
      ...ukrainian,
      tokens: {
        ...ukrainian.tokens,
        colors: {
          light: { ...ukrainian.tokens.colors.light, background: 'rgba(0, 0, 0, 0.5)' },
          dark: ukrainian.tokens.colors.dark,
        },
      },
    });

    expect(
      json(translucent, 'Generated/Assets.xcassets/backgroundLight.colorset/Contents.json'),
    ).toEqual(oneColor(['0.000', '0.000', '0.000', '0.500']));
  });

  it('renders the Mascot waiting, on red, to a vector image, light and dark', () => {
    expect(json(files, 'Generated/Assets.xcassets/mascot.imageset/Contents.json')).toEqual({
      images: [
        { idiom: 'universal', filename: 'mascot-light.svg' },
        { idiom: 'universal', filename: 'mascot-dark.svg', appearances: dark },
      ],
      info: { author: 'xcode', version: 1 },
      properties: { 'preserves-vector-representation': true },
    });
    for (const scheme of ['light', 'dark']) {
      const svg = text(files, `Generated/Assets.xcassets/mascot.imageset/mascot-${scheme}.svg`);
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="150" height="112"/);
      // The body in the on-accent cream and the ink in the light Theme's ink, in both appearances.
      expect(svg).toContain('fill="#FFF4E6"');
      expect(svg).toContain('fill="#140C0A"');
    }
  });

  it.each([
    ['mascot', 'waits'],
    ['mascotSleeps', 'sleeps'],
  ] as const)('draws the %s image in the %s state alone', (name, state) => {
    const mascot = loadDecor(ukrainianFolder.read('decor')).mascot;
    if (mascot === undefined) throw new Error('The UA Edition has a Mascot');
    const other = state === 'waits' ? 'sleeps' : 'waits';
    const svg = text(files, `Generated/Assets.xcassets/${name}.imageset/${name}-dark.svg`);
    const has = (shapes: readonly { path: string }[]) =>
      shapes.every((shape) => svg.includes(`d="${shape.path}"`));

    expect(has([...mascot.figure, ...mascot.eyes[state], ...mascot.hat])).toBe(true);
    expect(has(mascot.eyes[other])).toBe(false);
    expect(has(mascot.sleepMarks)).toBe(state === 'sleeps');
    expect(has(mascot.rays)).toBe(false);
  });

  it('writes no Mascot for an Edition without one', () => {
    const plain = widgetExtensionFiles({ ...ukrainian, mascot: undefined });

    expect([...plain.keys()].some((path) => path.includes('mascot'))).toBe(false);
  });

  it("writes the widget's strings, its Widget Modes and its states into the string table of the Edition's language", () => {
    expect(text(files, 'Generated/uk.lproj/Localizable.strings')).toBe(
      '"galleryName" = "Рідкісне слово";\n' +
        '"galleryDescription" = "Нове рідкісне слово на головному екрані кожні п’ять хвилин.";\n' +
        '"allEntries" = "УСІ СЛОВА";\n' +
        '"favorites" = "УЛЮБЛЕНЕ";\n' +
        '"collection" = "КОЛЕКЦІЯ · {name}";\n' +
        '"modeTitle" = "Режим";\n' +
        '"modeFavorites" = "Улюблене";\n' +
        '"modeCollection" = "Колекція";\n' +
        '"modeAllEntries" = "Усі слова";\n' +
        '"collectionTitle" = "Колекція";\n' +
        '"openApp" = "Відкрийте SLOVO";\n' +
        '"noFavorites" = "Додайте слова в Улюблене";\n' +
        '"emptyCollection" = "Колекція порожня";\n' +
        '"deletedCollection" = "Колекцію видалено — оберіть інший режим";\n' +
        '"noCollection" = "Оберіть колекцію для віджета";\n' +
        '"wordOfTheDaySeen" = "Слово дня переглянуто";\n' +
        '"backgroundTitle" = "Тло";\n' +
        '"backgroundAuto" = "Авто";\n' +
        '"backgroundLight" = "Світлий";\n' +
        '"backgroundDark" = "Темний";\n' +
        '"backgroundParchment" = "Пергамент";\n' +
        '"backgroundBlue" = "Синій";\n',
    );
  });

  it('escapes quotes, backslashes and line breaks in a string', () => {
    const quoted = widgetExtensionFiles({
      ...ukrainian,
      strings: { ...ukrainian.strings, galleryName: 'Say "hi"\\\nnow' },
    });

    expect(text(quoted, 'Generated/uk.lproj/Localizable.strings')).toContain(
      '"galleryName" = "Say \\"hi\\"\\\\\\nnow";\n',
    );
  });

  it('bundles the fonts it is given', () => {
    const font = readFileSync(fontFiles[0] ?? '');

    // Buffer.equals, as an element-wise comparison of a whole font is slow.
    expect(font.equals(Buffer.from(files.get('Generated/Onest-Bold.ttf') ?? ''))).toBe(true);
    expect(files.get('Generated/Unbounded-SemiBold.ttf')).toBeInstanceOf(Buffer);
  });

  it('bundles the example Widget Snapshot for the gallery preview', () => {
    expect(
      WidgetSnapshotSchema.safeParse(json(files, 'Generated/widget-snapshot.example.json')).success,
    ).toBe(true);
  });

  it("writes the Info.plist with the fonts, the App Group, the scheme, the Edition id and the Edition's font families", () => {
    expect(plist.parse(text(files, 'Info.plist'))).toEqual({
      CFBundleDevelopmentRegion: 'uk',
      CFBundleDisplayName: 'SLOVO',
      CFBundleLocalizations: ['uk'],
      NSExtension: { NSExtensionPointIdentifier: 'com.apple.widgetkit-extension' },
      UIAppFonts: ['Onest-Bold.ttf', 'Unbounded-SemiBold.ttf'],
      SLOVOAppGroup: 'group.app.slovo.uk',
      SLOVOURLScheme: 'slovo-uk',
      SLOVOEditionId: 'uk',
      SLOVOLockScreenWidget: true,
      SLOVOWordFont: 'Unbounded',
      SLOVOUIFont: 'Onest',
    });
  });

  it("offers the lock-screen widget only while the Edition's Feature Switch has it on", () => {
    const { config } = ukrainian;
    const off = widgetExtensionFiles({
      ...ukrainian,
      config: {
        ...config,
        featureSwitches: { ...config.featureSwitches, lockScreenWidget: false },
      },
    });

    const info = plist.parse(text(off, 'Info.plist')) as Record<string, unknown>;

    expect(info['SLOVOLockScreenWidget']).toBe(false);
  });

  it('leaves the font families out for an Edition on the system font', () => {
    const system = widgetExtensionFiles({ ...ukrainian, tokens: coreTokens, fontFiles: [] });

    const info = plist.parse(text(system, 'Info.plist')) as Record<string, unknown>;

    expect(info['SLOVOWordFont']).toBeUndefined();
    expect(info['SLOVOUIFont']).toBeUndefined();
    expect(info['UIAppFonts']).toEqual([]);
  });

  it('writes the asset catalog itself', () => {
    expect(json(files, 'Generated/Assets.xcassets/Contents.json')).toEqual({
      info: { author: 'xcode', version: 1 },
    });
  });
});

describe('writing the Edition files into the widget extension', () => {
  it("writes every file and drops those an earlier prebuild left, such as another Edition's font", () => {
    const widgetDir = mkdtempSync(join(tmpdir(), 'slovo-widget-'));
    try {
      mkdirSync(join(widgetDir, 'Generated'));
      writeFileSync(join(widgetDir, 'Generated/Other-Regular.ttf'), 'old');
      writeFileSync(join(widgetDir, 'Widget.swift'), 'kept');

      writeWidgetExtension(widgetDir, ukrainian);

      expect(existsSync(join(widgetDir, 'Generated/Other-Regular.ttf'))).toBe(false);
      expect(readFileSync(join(widgetDir, 'Widget.swift'), 'utf8')).toBe('kept');
      for (const [path, contents] of widgetExtensionFiles(ukrainian)) {
        expect(readFileSync(join(widgetDir, path)).equals(Buffer.from(contents)), path).toBe(true);
      }
    } finally {
      rmSync(widgetDir, { recursive: true, force: true });
    }
  });
});
